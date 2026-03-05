import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para buscar qualquer URL de vídeo no objeto de resposta
function findVideoLink(obj: any): string | null {
  if (!obj) return null;
  const str = JSON.stringify(obj);

  // Tenta encontrar URLs que terminam em formatos de vídeo ou URIs de armazenamento
  const patterns = [
    /"video_url":\s*"([^"]+)"/,
    /"videoUri":\s*"([^"]+)"/,
    /"gcsUri":\s*"([^"]+)"/,
    /"fileUri":\s*"([^"]+)"/,
    /"url":\s*"([^"]+)"/,
    /"uri":\s*"([^"]+)"/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) return match[1];
  }

  // Fallback: Procura qualquer string que comece com http e tenha .mp4 ou similar
  const genericMatch = str.match(/"(https?:\/\/[^"]+\.(mp4|mov|webm)[^"]*)"/i);
  if (genericMatch) return genericMatch[1];

  return null;
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
            prompt: `Highly realistic cinematic vertical video (9:16) of a professional corporate presenter, ${profile.avatar_gender}, speaking naturally and confidently to the camera. Modern professional office background, high quality lighting, smooth motions, 4k.`
          }]
        })
      })

      const opData = await veoRes.json()
      if (!veoRes.ok) throw new Error(`Erro Inicial: ${opData.error?.message || JSON.stringify(opData)}`)

      if (opData.name) {
        let attempts = 0
        let success = false

        while (attempts < 45) { // Espera até 90 segundos
          attempts++
          await new Promise(r => setTimeout(r, 2000))

          const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`)
          const pollData = await pollRes.json()

          if (pollData.done) {
            if (pollData.error) throw new Error(`Erro na Geração: ${pollData.error.message}`)

            // BUSCA INTELIGENTE: Procura o link em qualquer lugar da resposta do Google
            const foundLink = findVideoLink(pollData.response);

            if (foundLink) {
              finalVideoUrl = foundLink
              success = true
              debugInfo = ""
              break
            } else {
              // Se terminou e não achou link, mostra o que o Google mandou para investigarmos
              debugInfo = `🚨 GOOGLE OK, MAS LINK SUMIU: ${JSON.stringify(pollData.response).substring(0, 100)}...`
              break;
            }
          }
        }

        if (!success && !debugInfo) {
          debugInfo = "⚠️ O Google demorou demais para finalizar o vídeo."
        }
      }

    } catch (e: any) {
      debugInfo = `🚨 ERRO TÉCNICO: ${e.message}`
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
          ? `⚠️ *STUDIO IA:* Erro ao localizar vídeo profissional.\n\nVeja o relatório no painel.`
          : `✅ *STUDIO IA:* Seu avatar profissional está pronto!\n\nVerifique o painel para aprovar.`

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
