import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { post_id, company_id } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: post } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()

    if (!post || !profile) throw new Error("Dados não encontrados.")

    let errorReport = ""
    let finalVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"

    try {
      const AI_STUDIO_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY')
      if (!AI_STUDIO_KEY) throw new Error("A chave GOOGLE_AI_STUDIO_KEY não foi encontrada.")

      // VEO VIA GOOGLE AI STUDIO (Gemini API)
      // Removi 'duration_seconds' pois o modelo de preview no AI Studio pode ter duração fixa ou não aceitar esse parâmetro agora.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`

      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Cinematic 4k vertical video (9:16) of a professional corporate presenter, ${profile.avatar_gender}, speaking naturally to the camera in a modern office. High quality lighting and realistic motion.`
          }],
          parameters: {
            aspect_ratio: "9:16"
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
        while (attempts < 30 && (Date.now() - startTime) < 55000) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))

          const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`
          const pollRes = await fetch(pollUrl)
          const pollData = await pollRes.json()

          if (pollData.done) {
            if (pollData.error) throw new Error(`ERRO_GERACAO: ${pollData.error.message}`)

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

    // Notificar WhatsApp usando as chaves reais do .env
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

        const msg = errorReport
          ? `⚠️ *STUDIO IA:* Erro de faturamento ou quota no AI Studio.\nMotivo: ${errorReport.split('\n')[1]}`
          : `✅ *STUDIO IA:* Seu vídeo profissional está pronto!\n\nVerifique o painel para aprovar.`

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
