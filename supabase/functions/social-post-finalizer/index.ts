import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGoogleToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000)
  const privateKey = await jose.importPKCS8(serviceAccount.private_key.replace(/\\n/g, '\n'), 'RS256')
  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt })
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, content } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Fetch Profile
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (!profile) throw new Error("Perfil não encontrado.")

    // 2. Create Post Record
    const { data: post } = await supabase.from('social_posts').insert({
      company_id, content, status: 'pending', media_type: profile.video_enabled ? 'reels' : 'feed'
    }).select().single()

    let finalMediaUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; // Default fallback
    let videoCompleted = false;

    // 3. Generate Media
    if (profile.video_enabled) {
      console.log("Iniciando geração de VÍDEO...");
      const googleServiceAccount = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (googleServiceAccount) {
        const sa = JSON.parse(googleServiceAccount)
        const token = await getGoogleToken(sa)

        // TTS
        const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: content },
            voice: { languageCode: "pt-BR", name: profile.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B' },
            audioConfig: { audioEncoding: "MP3" }
          })
        })
        const ttsData = await ttsRes.json()

        if (ttsData.audioContent) {
          // Vertex Veo (Predict Long Running)
          const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/veo-3.1-fast-generate-preview:predictLongRunning`
          const veoRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt: `Realistic ${profile.avatar_gender} professional avatar speaking naturally. Corporate setting.`, audio_base64: ttsData.audioContent, aspect_ratio: "9:16" }],
              parameters: { duration_seconds: 3, sample_count: 1 } // Reduzido para 3s para garantir velocidade
            })
          })
          const opData = await veoRes.json()

          if (opData.name) {
            const opName = opData.name
            let attempts = 0
            while (attempts < 20) { // Polling por ~40 segundos
              attempts++
              await new Promise(r => setTimeout(r, 2000))
              const poll = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/${opName}`, {
                headers: { "Authorization": `Bearer ${token}` }
              })
              const pollData = await poll.json()
              if (pollData.done && pollData.response?.predictions?.[0]?.video_url) {
                finalMediaUrl = pollData.response.predictions[0].video_url
                videoCompleted = true
                break
              }
            }
          }
        }
      }
    } else {
      console.log("Iniciando geração de IMAGEM...");
      const openaiKey = Deno.env.get('OPENAI_API_KEY')
      const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: `Professional photography of ${profile.niche} niche. High quality. Target audience: ${profile.target_audience}.`, n: 1, size: '1024x1024' })
      })
      const imgData = await imgRes.json()
      if (imgData.data?.[0]?.url) {
        finalMediaUrl = imgData.data[0].url
        videoCompleted = true
      }
    }

    // 4. Update Database
    await supabase.from('social_posts').update({ image_url: finalMediaUrl }).eq('id', post.id)

    // 5. WhatsApp Notification
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'
        const msgText = `🎥 *STUDIO IA FINALIZADO!*\n\nSeu post de ${profile.video_enabled ? 'VÍDEO' : 'IMAGEM'} está pronto para aprovação.\n\n*Legenda:*\n${content.slice(0, 500)}...\n\nResponda *1* para aprovar!`

        await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
          body: JSON.stringify({ number: profile.approval_whatsapp.replace(/\D/g, ''), text: msgText, textMessage: { text: msgText } })
        }).catch(e => console.error("Erro WhatsApp:", e))
      }
    }

    return new Response(JSON.stringify({ success: true, post_id: post.id, media_url: finalMediaUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Erro Fatal:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
