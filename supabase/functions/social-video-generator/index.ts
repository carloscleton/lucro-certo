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
      const AI_STUDIO_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY')
      if (!AI_STUDIO_KEY) throw new Error("A chave GOOGLE_AI_STUDIO_KEY não foi encontrada.")

      // 1. VEO VIA GOOGLE AI STUDIO (Gemini API)
      // Removendo audio_base64 que não é suportado pelo modelo de preview no AI Studio
      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`

      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Extremely realistic 4k video of a professional ${profile.avatar_gender} corporate presenter speaking to the camera. Vertical 9:16 aspect ratio, high quality lighting, professional office background. The presenter is moving naturally and talking.`,
            aspect_ratio: "9:16"
          }],
          parameters: {
            duration_seconds: 5
          }
        })
      })

      const opData = await veoRes.json()

      if (!veoRes.ok) {
        throw new Error(`ERRO_AI_STUDIO: ${opData.error?.message || JSON.stringify(opData)}`)
      }

      if (opData.name) {
        let attempts = 0
        const startTime = Date.now()
        while (attempts < 25 && (Date.now() - startTime) < 50000) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))

          const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`
          const pollRes = await fetch(pollUrl)
          const pollData = await pollRes.json()

          if (pollData.done) {
            if (pollData.error) throw new Error(`ERRO_GERACAO: ${pollData.error.message}`)

            // Tentando capturar a URL do vídeo de diferentes possíveis campos da resposta beta
            finalVideoUrl = pollData.response?.predictions?.[0]?.video_url ||
              pollData.response?.predictions?.[0]?.gcsUri ||
              pollData.response?.predictions?.[0]?.videoUri ||
              finalVideoUrl
            break
          }
        }
      }

    } catch (e: any) {
      console.error("Pipeline Failure:", e.message)
      errorReport = `🚨 ALERTA DE ERRO IA 🚨\nMotivo: ${e.message}\n\n`
    }

    // Atualizar Post
    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: post.content.includes("🚨 ALERTA") ? post.content : (errorReport + post.content),
      status: 'pending'
    }).eq('id', post_id)

    // Notificar WhatsApp
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

        const msg = errorReport
          ? `⚠️ *STUDIO IA:* Erro ao processar vídeo no AI Studio.\n\nVerifique o painel para detalhes.`
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
