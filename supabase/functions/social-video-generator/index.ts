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
    /"uri":\s*"([^"]+)"/,
    /"gcsUri":\s*"([^"]+)"/,
    /"fileUri":\s*"([^"]+)"/,
    /"url":\s*"([^"]+)"/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) {
      let link = match[1];
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
      if (!AI_STUDIO_KEY) throw new Error("Chave AI Studio não encontrada.")

      // 1. GERAÇÃO INICIAL (8 Segundos)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${AI_STUDIO_KEY}`
      const veoRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: `Cinematic professional 4k vertical video (9:16) of a corporate ${profile.avatar_gender || 'male'} presenter, style ${profile.avatar_style || 'professional'}, speaking naturally and confidently to the camera in ${profile.language || 'Portuguese'}. Modern office background, high quality lighting.`
          }]
        })
      })

      const opData = await veoRes.json()
      if (!veoRes.ok) throw new Error(`Google recusou inicial: ${opData.error?.message}`)

      let currentVideoLink = null;
      if (opData.name) {
        let attempts = 0
        while (attempts < 45) {
          attempts++
          await new Promise(r => setTimeout(r, 2000))
          const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opData.name}?key=${AI_STUDIO_KEY}`)
          const pollData = await pollRes.json()
          if (pollData.done) {
            currentVideoLink = findVideoLink(pollData.response);
            break;
          }
        }
      }

      // 2. EXTENSÃO (Opcional - Tentativa de +7s para chegar a 15s)
      if (currentVideoLink) {
        finalVideoUrl = currentVideoLink;

        try {
          const extensionPrompt = `The corporate ${profile.avatar_gender || 'male'} presenter continues their professional speech with natural gestures in the same modern office environment. Seamless transition.`;

          const extendRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{
                prompt: extensionPrompt,
                videoUri: currentVideoLink.replace('https://storage.googleapis.com/', 'gs://')
              }]
            })
          })

          const extendOp = await extendRes.json();
          if (extendRes.ok && extendOp.name) {
            let extAttempts = 0;
            while (extAttempts < 45) {
              extAttempts++;
              await new Promise(r => setTimeout(r, 2000));
              const pollExt = await fetch(`https://generativelanguage.googleapis.com/v1beta/${extendOp.name}?key=${AI_STUDIO_KEY}`);
              const pollExtData = await pollExt.json();
              if (pollExtData.done) {
                const extLink = findVideoLink(pollExtData.response);
                if (extLink) finalVideoUrl = extLink;
                break;
              }
            }
          }
        } catch (extE) {
          console.error("Erro na extensão:", extE);
        }
      } else {
        throw new Error("Não foi possível gerar o vídeo inicial.");
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
      const { data: instances } = await supabase.from('instances')
        .select('instance_name, evolution_instance_id')
        .eq('company_id', company_id)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(1)

      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '') || 'https://evo.idealzap.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY')

        if (!EVO_KEY) {
          console.error("EVOLUTION_API_KEY não configurada.")
        } else {
          const msg = debugInfo
            ? `⚠️ *STUDIO IA:* Houve um problema ao gerar seu vídeo.\n\nVerifique o painel.`
            : `✅ *STUDIO IA:* Seu vídeo profissional (15s) está pronto!\n\nVerifique o painel para aprovar.`

          const number = profile.approval_whatsapp.replace(/\D/g, '')

          const waRes = await fetch(`${EVO_URL}/message/sendText/${instance.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY
            },
            body: JSON.stringify({
              number: number,
              text: msg
            })
          })

          const waData = await waRes.json()
          if (!waRes.ok) console.error("Erro WhatsApp:", waData)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
