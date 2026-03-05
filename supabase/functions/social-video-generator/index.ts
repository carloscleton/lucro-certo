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

    let diagnosticMsg = ""
    let finalVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4" // Fallback do coelho (reserva)

    try {
      const GOOGLE_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (!GOOGLE_JSON) throw new Error("ERRO: Sua Chave do Google Cloud não foi encontrada no servidor.")

      const sa = JSON.parse(GOOGLE_JSON)
      const token = await getAccessToken(sa)

      // Tentativa de Geração (Bare Minimum para Diagnóstico)
      const modelId = "veo-3.1-fast-generate-preview"
      const location = "us-central1"
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`

      const veoRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: `Realistic corporate professional avatar.`, aspect_ratio: "9:16" }],
          parameters: { duration_seconds: 3 }
        })
      })

      const opData = await veoRes.json()

      if (!veoRes.ok) {
        // AQUI ESTÁ A CHAVE: Se o Google der erro, vamos salvar o motivo!
        diagnosticMsg = `\n\n⚠️ ERRO GOOGLE CLOUD: ${opData.error?.message || JSON.stringify(opData)}`
        console.error("Google Cloud Refused:", opData)
      } else {
        // Se deu certo, continuamos o polling
        let attempts = 0
        while (attempts < 20) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))
          const poll = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${opData.name}`, {
            headers: { "Authorization": `Bearer ${token}` }
          })
          const pollData = await poll.json()
          if (pollData.done && pollData.response?.predictions?.[0]?.video_url) {
            finalVideoUrl = pollData.response.predictions[0].video_url
            break
          }
          if (pollData.error) {
            diagnosticMsg = `\n\n⚠️ O Google iniciou o vídeo mas falhou no meio: ${pollData.error.message}`
            break
          }
        }
      }
    } catch (e) {
      diagnosticMsg = `\n\n⚠️ ERRO SISTEMA: ${e.message}`
    }

    // Atualizar o post com o vídeo informativo e a mensagem de erro no corpo para você ver
    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: post.content + diagnosticMsg,
      status: 'pending'
    }).eq('id', post_id)

    // Notificar WhatsApp
    if (profile?.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'
        const msg = `🎥 *STUDIO IA DIAGNÓSTICO:* ${diagnosticMsg ? '⚠️ ERRO DETECTADO' : '✅ VÍDEO PRONTO'}\n\nVerifique o painel para ver o relatório do erro.`

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
