import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações do Google Cloud
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000)
  const privateKey = await jose.importPKCS8(serviceAccount.private_key, 'RS256')

  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  })

  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { post_id, company_id } = await req.json()

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado.")
    }

    const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Obter dados do Post e Perfil
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('*, social_profiles(*)')
      .eq('id', post_id)
      .single()

    if (postErr || !post) throw new Error("Post não encontrado.")

    const profile = post.social_profiles
    const script = post.content

    console.log(`Iniciando geração de vídeo para o post ${post_id}`)

    // 2. Obter Token do Google
    const accessToken = await getAccessToken(serviceAccount)

    // 3. Google Cloud Text-to-Speech (Gerar Áudio)
    // Escolhe a voz baseada no gênero do perfil
    const voiceName = profile.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B'

    const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: { text: script },
        voice: { languageCode: "pt-BR", name: voiceName },
        audioConfig: { audioEncoding: "MP3" }
      })
    })

    const ttsData = await ttsRes.json()
    if (!ttsData.audioContent) throw new Error("Falha ao gerar áudio TTS.")

    // 4. Vertex AI Veo 3.1 (Gerar Vídeo com Avatar)
    // Nota: Em 2026, usamos o endpoint do Veo no Vertex AI.
    // Simulando a chamada de vídeo que integra o áudio.

    const project = serviceAccount.project_id
    const location = "us-central1" // Local padrão para Vertex AI Video
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/veo-3-1:predict`

    const brandInfo = profile.brand_logo_url ? `with the company logo (${profile.brand_logo_url}) as a watermark` : '';
    const colorInfo = profile.brand_primary_color ? `The color scheme of the scene should subtly incorporate the brand color ${profile.brand_primary_color}.` : '';

    const prompt = `A professional ${profile.avatar_gender === 'male' ? 'man' : 'woman'} avatar in a ${profile.avatar_style} setting, speaking naturally to the camera. 
    High quality, realistic lip-sync, corporate social media video style. ${brandInfo} ${colorInfo}`;

    const veoRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt,
            audio_base64: ttsData.audioContent, // Passando o áudio para sincronia
            aspect_ratio: "9:16"
          }
        ],
        parameters: {
          duration_seconds: 10,
          sample_count: 1
        }
      })
    })

    const veoData = await veoRes.json()
    console.log("Veo Response:", JSON.stringify(veoData).slice(0, 500))

    // O Veo retorna uma URL ou um job_id. Em 2026, pode ser síncrono para vídeos curtos.
    const videoResult = veoData.predictions?.[0]?.video_url || veoData.predictions?.[0]?.content

    if (!videoResult) throw new Error("Falha ao gerar vídeo com Veo 3.1.")

    // 5. Salvar o vídeo no Supabase Storage
    const videoName = `video_${post_id}_${Date.now()}.mp4`
    const videoBlob = await (await fetch(videoResult)).blob()

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('social_media_assets')
      .upload(`${company_id}/${videoName}`, videoBlob, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (uploadErr) throw uploadErr

    const { data: publicUrlData } = supabase.storage
      .from('social_media_assets')
      .getPublicUrl(`${company_id}/${videoName}`)

    const videoUrl = publicUrlData.publicUrl

    // 6. Atualizar o Post com a URL do vídeo
    await supabase.from('social_posts')
      .update({ image_url: videoUrl, media_type: 'reels' })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ success: true, videoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error("Erro no social-video-generator:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
