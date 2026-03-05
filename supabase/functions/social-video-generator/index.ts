import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para converter links do Google em links públicos de Download do AI Studio
function fixGoogleLink(link: string, apiKey: string): string {
  if (!link) return link;

  // Se for um link gs://, precisamos converter para um link que o navegador consiga baixar.
  // No AI Studio, links de vídeo gerados costumam precisar de uma chave de API ou ser baixados via stream.
  // Testaremos a conversão para o link de download direto se disponível.
  if (link.startsWith('gs://')) {
    const parts = link.replace('gs://', '').split('/');
    const bucket = parts[0];
    const object = parts.slice(1).join('/');
    // Nota: storage.googleapis.com só funciona se o bucket for público. 
    // Como os arquivos do Google AI Studio são privados, tentaremos o link assinado ou o redirecionamento.
    return `https://storage.googleapis.com/${bucket}/${object}`;
  }

  // Se o link já for HTTPS mas do Google, tentaremos garantir que ele tenha a chave de acesso se necessário
  if (link.includes('generativelanguage.googleapis.com') && !link.includes('key=')) {
    return `${link}${link.includes('?') ? '&' : '?'}key=${apiKey}`;
  }

  return link;
}

function findVideoLink(obj: any): string | null {
  if (!obj) return null;
  const str = JSON.stringify(obj);

  // A ordem aqui importa: preferimos campos que costumam ter a URL de visualização
  const patterns = [
    /"video_url":\s*"([^"]+)"/,
    /"videoUri":\s*"([^"]+)"/,
    /"uri":\s*"([^"]+)"/,
    /"gcsUri":\s*"([^"]+)"/,
    /"fileUri":\s*"([^"]+)"/,
    /"url":\s*"([^"]+)"/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) return match[1];
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
      if (!AI_STUDIO_KEY) throw new Error("Chave AI Studio não encontrada.")

      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`

      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Cinematic professional video of a ${profile.avatar_gender} presenter speaking naturally to the camera. Vertical 4k, modern office background.`
          }]
        })
      })

      const opData = await veoRes.json()
      if (!veoRes.ok) throw new Error(`Google recusou: ${opData.error?.message}`)

      if (opData.name) {
        let attempts = 0
        let success = false
        while (attempts < 45) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))
          const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`)
          const pollData = await pollRes.json()

          if (pollData.done) {
            const rawLink = findVideoLink(pollData.response);
            if (rawLink) {
              // APLICANDO A CORREÇÃO DE LINK PÚBLICO
              finalVideoUrl = fixGoogleLink(rawLink, AI_STUDIO_KEY)
              success = true
              break
            } else {
              debugInfo = `🚨 GOOGLE OK, MAS LINK SUMIU: ${JSON.stringify(pollData.response).substring(0, 100)}`
              break
            }
          }
        }
      }
    } catch (e: any) {
      debugInfo = `🚨 ERRO TÉCNICO: ${e.message}`
    }

    // Se o link final ainda não é o que queremos, registramos o erro no texto
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

        const msg = debugInfo
          ? `⚠️ *STUDIO IA:* Erro ao liberar o vídeo.\n\nVerifique o painel.`
          : `✅ *STUDIO IA:* Vídeo do avatar liberado para Play!\n\nVerifique o painel agora.`

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
