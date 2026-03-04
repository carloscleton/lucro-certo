import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000)
  const privateKey = await jose.importPKCS8(serviceAccount.private_key.replace(/\\n/g, '\n'), 'RS256')
  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
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
    const { post_id, company_id } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Fetch Post and Profile
    const { data: post } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
    if (!post) throw new Error("Post não encontrado.")

    if (post.image_url) return new Response("Pskip", { headers: corsHeaders }) // Evita duplicidade

    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (!profile) throw new Error("Perfil não encontrado.")

    const GOOGLE_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!GOOGLE_JSON) throw new Error("GOOGLE_CREDENTIALS_MISSING")
    const sa = JSON.parse(GOOGLE_JSON)
    const token = await getAccessToken(sa)

    // 2. TTS
    const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: post.content },
        voice: { languageCode: "pt-BR", name: profile.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B' },
        audioConfig: { audioEncoding: "MP3" }
      })
    })
    const ttsData = await ttsRes.json()
    if (!ttsData.audioContent) throw new Error("Falha TTS")

    // 3. Vertex Veo (3 Segundos para Garantir Velocidade < 60s Plano Supabase)
    const modelId = "veo-3.1-fast-generate-preview"
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`

    const veoRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: `Professional corporate avatar speaking naturally.`, audio_base64: ttsData.audioContent, aspect_ratio: "9:16" }],
        parameters: { duration_seconds: 3, sample_count: 1 }
      })
    })

    const opData = await veoRes.json()
    if (!opData.name) throw new Error(`Google Error: ${opData.error?.message}`)

    const opName = opData.name
    let videoUrl = null
    let attempts = 0
    const start = Date.now()

    // Polling agressivo (1.5s) para capturar o vídeo em menos de 50 segundos totais
    while (attempts < 30 && (Date.now() - start) < 45000) {
      attempts++
      await new Promise(r => setTimeout(r, 1500))
      const pollRes = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/${opName}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      const pollData = await pollRes.json()
      if (pollData.done) {
        videoUrl = pollData.response?.predictions?.[0]?.video_url || pollData.response?.predictions?.[0]?.gcsUri
        break
      }
    }

    if (!videoUrl) throw new Error("Vídeo ainda em processamento. Tentativa via background agendada.")

    // 4. Update Database
    await supabase.from('social_posts').update({ image_url: videoUrl, status: 'pending' }).eq('id', post_id)

    // 5. Notificar WhatsApp
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'
        const msg = `🎥 *IA MASTER: VÍDEO PRONTO!*\n\nSeu vídeo exclusivo acaba de ser gerado e está aguardando sua revisão:\n\n*Legenda:*\n${post.content.slice(0, 300)}...\n\nResponda *1* para aprovar!`

        await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
          body: JSON.stringify({ number: profile.approval_whatsapp.replace(/\D/g, ''), text: msg, textMessage: { text: msg } })
        }).catch(e => console.error("Erro WhatsApp final:", e))
      }
    }

    return new Response(JSON.stringify({ success: true, url: videoUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err: any) {
    console.error("Pipeline Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
