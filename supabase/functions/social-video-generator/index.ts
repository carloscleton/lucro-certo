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

  const logs: string[] = []
  const addLog = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const { post_id, company_id, debug = false } = await req.json()
    addLog(`[START] Post: ${post_id}, Company: ${company_id}`)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Fetch Post and Profile
    const { data: post, error: postErr } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
    if (postErr || !post) throw new Error(`Post não encontrado: ${postErr?.message}`)

    const { data: profile, error: profErr } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (profErr || !profile) throw new Error(`Perfil não encontrado: ${profErr?.message}`)

    const GOOGLE_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!GOOGLE_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing from environment")

    const sa = JSON.parse(GOOGLE_JSON)
    addLog(`[AUTH] Project ID: ${sa.project_id}, Email: ${sa.client_email}`)

    const token = await getAccessToken(sa)
    addLog(`[AUTH] Token acquired (len: ${token.length})`)

    // 2. TTS
    addLog(`[TTS] Voice: ${profile.avatar_gender}, Content: ${post.content.substring(0, 50)}...`)
    const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: post.content },
        voice: { languageCode: "pt-BR", name: profile.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B' },
        audioConfig: { audioEncoding: "MP3" }
      })
    })

    if (!ttsRes.ok) {
      const ttsError = await ttsRes.text()
      throw new Error(`Google TTS Error (${ttsRes.status}): ${ttsError}`)
    }

    const ttsData = await ttsRes.json()
    if (!ttsData.audioContent) throw new Error("Google TTS response missing audioContent")
    addLog(`[TTS] Success (audioContent len: ${ttsData.audioContent.length})`)

    // 3. Vertex Veo
    const modelId = "veo-3.1-fast-generate-preview"
    const location = "us-central1"
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`

    addLog(`[VEO] Endpoint: ${endpoint}`)
    const veoRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{
          prompt: `Professional high-quality corporate avatar speaking naturally. High realism. Consistent lighting.`,
          audio_base64: ttsData.audioContent,
          aspect_ratio: "9:16"
        }],
        parameters: {
          duration_seconds: 3,
          sample_count: 1
        }
      })
    })

    const opData = await veoRes.json()
    if (!veoRes.ok) {
      throw new Error(`Vertex Veo Error (${veoRes.status}): ${JSON.stringify(opData)}`)
    }

    const opName = opData.name
    if (!opName) throw new Error(`Google Veo response missing operation name: ${JSON.stringify(opData)}`)
    addLog(`[VEO] Operation Started: ${opName}`)

    let videoUrl = null
    let attempts = 0
    const maxAttempts = 30
    const startTime = Date.now()

    while (attempts < maxAttempts && (Date.now() - startTime) < 50000) {
      attempts++
      addLog(`[POLL] Attempt ${attempts}...`)
      await new Promise(r => setTimeout(r, 2000))

      const pollRes = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${opName}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })

      const pollData = await pollRes.json()
      if (!pollRes.ok) {
        addLog(`[POLL] Error on attempt ${attempts}: ${JSON.stringify(pollData)}`)
        continue
      }

      if (pollData.done) {
        addLog(`[POLL] Completed!`)
        if (pollData.error) throw new Error(`Google LRO Error: ${JSON.stringify(pollData.error)}`)
        videoUrl = pollData.response?.predictions?.[0]?.video_url || pollData.response?.predictions?.[0]?.gcsUri
        break
      }
    }

    if (!videoUrl) {
      addLog(`[VEO] Polling Timeout (50s)`)
      throw new Error("Timeout: O vídeo ainda não está pronto após 50 segundos.")
    }

    addLog(`[SUCCESS] Video URL: ${videoUrl}`)

    // 4. Update Database
    const { error: updateErr } = await supabase.from('social_posts').update({ image_url: videoUrl, status: 'pending' }).eq('id', post_id)
    if (updateErr) throw new Error(`Erro ao atualizar banco: ${updateErr.message}`)

    // 5. Notify WhatsApp
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'
        const msg = `🎥 *VÍDEO STUDIO IA FINALIZADO!*\n\nSeu vídeo exclusivo está pronto para aprovação.\n\n*Legenda:*\n${post.content.slice(0, 300)}...\n\nResponda *1* para aprovar!`

        await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
          body: JSON.stringify({ number: profile.approval_whatsapp.replace(/\D/g, ''), text: msg, textMessage: { text: msg } })
        }).catch(e => addLog(`[WHATS] Slack notification failed: ${e.message}`))
      }
    }

    return new Response(JSON.stringify({ success: true, url: videoUrl, logs: debug ? logs : undefined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    addLog(`[FATAL] ${err.message}`)
    return new Response(JSON.stringify({ error: err.message, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Usando 200 para garantir que o cliente leia os logs no body mesmo em erro
    })
  }
})
