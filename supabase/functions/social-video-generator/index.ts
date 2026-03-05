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

    const { data: post } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()

    if (!post || !profile) throw new Error("Dados não encontrados para processamento.")

    let errorReport = ""
    let finalVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"

    try {
      // 1. CHAVE DO GOOGLE AI STUDIO (Solicitada pelo usuário)
      const AI_STUDIO_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY')
      const GOOGLE_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

      if (!AI_STUDIO_KEY) throw new Error("A chave GOOGLE_AI_STUDIO_KEY não foi encontrada nas configurações.")

      // 2. TTS (Ainda usamos o Cloud Service Account para isso)
      let ttsAudioBase64 = ""
      if (GOOGLE_JSON) {
        const sa = JSON.parse(GOOGLE_JSON)
        const token = await getAccessToken(sa)

        const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: post.content.substring(0, 1000) },
            voice: { languageCode: "pt-BR", name: profile.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B' },
            audioConfig: { audioEncoding: "MP3" }
          })
        })
        const ttsData = await ttsRes.json()
        if (ttsRes.ok && ttsData.audioContent) {
          ttsAudioBase64 = ttsData.audioContent
        } else {
          console.error("TTS Fallback: Usando vídeo sem áudio personalizado devido a erro no TTS.")
        }
      }

      // 3. VEO VIA GOOGLE AI STUDIO (Gemini API)
      // Endpoint beta do AI Studio para geração de vídeo
      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`

      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Professional high-quality realistic ${profile.avatar_gender} corporate avatar speaking naturally. 4k resolution, smooth motion.`,
            audio_base64: ttsAudioBase64 || undefined,
            aspect_ratio: "9:16"
          }],
          parameters: {
            duration_seconds: 5,
            sample_count: 1
          }
        })
      })

      const opData = await veoRes.json()

      if (!veoRes.ok) {
        throw new Error(`ERRO_AI_STUDIO: ${opData.error?.message || JSON.stringify(opData)}`)
      }

      if (opData.name) {
        // 4. POLLING DA OPERAÇÃO (AI STUDIO)
        let attempts = 0
        const startTime = Date.now()
        // Polling por no máximo 50 segundos para evitar timeout da function do Supabase
        while (attempts < 25 && (Date.now() - startTime) < 50000) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))

          const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`
          const pollRes = await fetch(pollUrl)
          const pollData = await pollRes.json()

          if (pollData.done) {
            if (pollData.error) throw new Error(`ERRO_GERACAO_VIDEO: ${pollData.error.message}`)

            // O campo de resposta pode variar dependendo da versão, mas geralmente é pollData.response.predictions[0].videoUri
            finalVideoUrl = pollData.response?.predictions?.[0]?.video_url ||
              pollData.response?.predictions?.[0]?.gcsUri ||
              pollData.response?.predictions?.[0]?.videoUri ||
              finalVideoUrl
            break
          }
        }
      } else {
        throw new Error("O Google AI Studio não retornou o nome da operação.")
      }

    } catch (e) {
      console.error("Pipeline Failure:", e.message)
      errorReport = `🚨 ALERTA DE ERRO IA (AI STUDIO) 🚨\nMotivo: ${e.message}\n\n`
    }

    // 5. ATUALIZAR BANCO
    // Se falhou, mantemos o fallback mas avisamos o erro
    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: errorReport + post.content,
      status: 'pending'
    }).eq('id', post_id)

    // 6. WHATSAPP
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

        const msg = errorReport
          ? `⚠️ *STUDIO IA:* Erro na geração com AI Studio.\nMotivo: ${errorReport.split('\n')[1]}\n\nVerifique o painel.`
          : `✅ *STUDIO IA:* Seu vídeo profissional está pronto!\n\nLegenda autorizada para aprovação.`

        await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
          body: JSON.stringify({ number: profile.approval_whatsapp.replace(/\D/g, ''), text: msg })
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
