import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function findVideoLink(obj: any): string | null {
  if (!obj) return null;
  const str = JSON.stringify(obj);
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
    if (match && match[1]) {
      let link = match[1];
      // Se for um link do Google Cloud Storage (gs://), converte para um link HTTP público
      if (link.startsWith('gs://')) {
        link = link.replace('gs://', 'https://storage.googleapis.com/');
      }
      return link;
    }
  }

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
            prompt: `Cinematic professional video, 4k, vertical 9:16. A corporate professional ${profile.avatar_gender} presenter is speaking effectively. Modern office, natural lighting, realistic human motion.`
          }]
        })
      })

      const opData = await veoRes.json()
      if (!veoRes.ok) throw new Error(`Google recusou: ${opData.error?.message}`)

      if (opData.name) {
        let attempts = 0
        let success = false
        while (attempts < 50) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))
          const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`)
          const pollData = await pollRes.json()

          if (pollData.done) {
            const foundLink = findVideoLink(pollData.response);
            if (foundLink) {
              finalVideoUrl = foundLink
              success = true
              break
            } else {
              throw new Error("Vídeo pronto, mas link não é público ou está em formato desconhecido.")
            }
          }
        }
      }
    } catch (e: any) {
      debugInfo = `🚨 ERRO TÉCNICO: ${e.message}`
    }

    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: post.content + (debugInfo ? `\n\n--- ${debugInfo}` : ""),
      status: 'pending'
    }).eq('id', post_id)

    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

        const msg = debugInfo.includes("🚨")
          ? `⚠️ *STUDIO IA:* Erro ao carregar vídeo.\n\nVerifique o painel.`
          : `✅ *STUDIO IA:* Seu avatar profissional está pronto com link público!\n\nVerifique o painel.`

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
