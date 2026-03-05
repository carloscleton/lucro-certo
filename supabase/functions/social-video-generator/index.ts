import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    let debugInfo = ""
    let finalVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"

    try {
      const AI_STUDIO_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY')
      if (!AI_STUDIO_KEY) throw new Error("Chave AI Studio não configurada.")

      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`

      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Highly realistic professional ${profile.avatar_gender} corporate presenter. Speaking directly to camera, friendly, 4k, vertical studio lighting. The person is moving and talking naturally.`
          }]
        })
      })

      const opData = await veoRes.json()
      if (!veoRes.ok) throw new Error(`Google recusou pedido: ${opData.error?.message}`)

      if (opData.name) {
        debugInfo = "[Aguardando Google desenhar o vídeo...]"
        let attempts = 0
        let success = false

        while (attempts < 40) { // Aumentado para ~80 segundos total
          attempts++
          await new Promise(r => setTimeout(r, 2000))

          const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`)
          const pollData = await pollRes.json()

          if (pollData.done) {
            if (pollData.error) throw new Error(`Erro na geração: ${pollData.error.message}`)

            // BUSCA EXAUSTIVA PELO LINK DO VÍDEO
            const predictions = pollData.response?.predictions || []
            const firstPred = predictions[0] || {}

            const foundUrl = firstPred.video_url || firstPred.gcsUri || firstPred.videoUri || firstPred.uri || firstPred.url

            if (foundUrl) {
              finalVideoUrl = foundUrl
              success = true
              debugInfo = "" // Limpa o debug se deu certo
              break
            } else {
              throw new Error("Google terminou mas não enviou o link do vídeo.")
            }
          }
        }

        if (!success && !debugInfo.includes("Erro")) {
          debugInfo = "⚠️ O Google demorou demais (>80s). O vídeo pode aparecer no painel em instantes."
        }
      }

    } catch (e: any) {
      debugInfo = `🚨 NOTA TÉCNICA: ${e.message}`
    }

    // Atualizar Post
    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: post.content + (debugInfo ? `\n\n--- ${debugInfo}` : ""),
      status: 'pending'
    }).eq('id', post_id)

    // Notificar WhatsApp
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

        const msg = debugInfo.includes("🚨")
          ? `⚠️ *STUDIO IA:* Houve um problema no Google.\n\nVerifique o texto do post para detalhes.`
          : `✅ *STUDIO IA:* Vídeo enviado ao servidor!\n\nSe o coelho aparecer, aguarde 30s e dê F5.`

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
