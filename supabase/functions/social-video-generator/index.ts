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
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()

    // --- CONTROLE DE USO DIÁRIO ---
    const today = new Date().toISOString().split('T')[0];
    let dailyCount = profile.daily_video_count || 0;
    const dailyLimit = profile.daily_video_limit || 3;

    if (profile.last_video_date !== today) {
      dailyCount = 0;
      await supabase.from('social_profiles').update({ daily_video_count: 0, last_video_date: today }).eq('id', profile.id);
    }

    let debugInfo = ""
    let finalVideoUrl = post?.image_url || "https://www.w3schools.com/html/mov_bbb.mp4"

    if (dailyCount >= dailyLimit) {
      debugInfo = `🚨 LIMITE DIÁRIO ATINGIDO: Você já gerou ${dailyLimit} vídeos hoje. Tente novamente amanhã!`;
    }
    // ------------------------------

    // SÓ GERA VÍDEO SE ESTIVER HABILITADO E DENTRO DO LIMITE
    if (profile?.video_enabled && !debugInfo) {
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

        // 2. EXTENSÃO (Opcional - +7s)
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

        // Incrementa o uso diário se chegou até aqui com sucesso
        await supabase.from('social_profiles')
          .update({ daily_video_count: dailyCount + 1 })
          .eq('id', profile.id);

      } catch (e: any) {
        if (e.message.includes("quota") || e.message.includes("429")) {
          debugInfo = `🚨 LIMITE DE VÍDEOS ALCANÇADO: Quota do Google esgotada por hoje.`
        } else {
          debugInfo = `🚨 ERRO TÉCNICO VÍDEO: ${e.message}`
        }
      }
    } else if (!post.image_url || post.image_url.includes('w3schools')) {
      // GERA IMAGEM COM TEXTO SE VÍDEO ESTIVER DESLIGADO E NÃO TIVER IMAGEM VÁLIDA
      try {
        const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_KEY) {
          const imagePrompt = `Crie uma arte profissional e impactante para Instagram da empresa ${company?.trade_name || 'Lucro Certo'}. 
A imagem DEVE conter um título chamativo em português centralizado com tipografia moderna. 
Assunto: ${post.content.substring(0, 150)}. 
Estilo visual: Fotografia profissional humanizada. Público: ${profile.target_audience || 'Empreendedores'}. 
Gere o texto em português corretamente.`;

          const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: imagePrompt,
              n: 1,
              size: '1024x1024'
            })
          });
          const imageData = await imageRes.json();
          if (imageData.data && imageData.data.length > 0) {
            finalVideoUrl = imageData.data[0].url;
          }
        }
      } catch (imgErr) {
        console.error("Erro ao gerar imagem de backup:", imgErr);
      }
    }

    // Atualizar Post
    await supabase.from('social_posts').update({
      image_url: finalVideoUrl,
      content: post.content + (debugInfo ? `\n\n--- ${debugInfo}` : ""),
      status: 'pending'
    }).eq('id', post_id)

    // Notificar WhatsApp (COMPATIBILIDADE TOTAL COM EVOLUTION API)
    if (profile?.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances')
        .select('*')
        .eq('company_id', company_id)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(1)

      if (instances?.length) {
        const instance = instances[0]
        const EVO_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '') || 'https://evo.idealzap.com.br'
        const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

        const msg = `🤖 Olá! O seu *Marketing IA* preparou o post solicitado.

*Legenda:*
${post.content}

${profile.video_enabled ? '🎥 O vídeo de 15s está pronto para revisão!' : '📝 A imagem com texto chamativo está pronta!'}

Deseja Aprovar e Postar Agora?
Responda *1* para aprovar ou *NAO* para descartar.

_(Ref: Post ${post_id})_`

        const targetNumber = profile.approval_whatsapp.replace(/\D/g, '')

        // URL SEM TOKEN (Mais robusto para Evolution API v2)
        let endpoint = `${EVO_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}`;
        let payload: any = {
          number: targetNumber,
          options: { delay: 1000, presence: "composing" }
        };

        if (finalVideoUrl) {
          endpoint = `${EVO_URL}/message/sendMedia/${encodeURIComponent(instance.instance_name)}`;
          const isVideo = finalVideoUrl.toLowerCase().includes('.mp4') || finalVideoUrl.toLowerCase().includes('.mov') || finalVideoUrl.toLowerCase().includes('.webm');
          payload.mediatype = isVideo ? "video" : "image";
          payload.caption = msg;
          payload.media = finalVideoUrl;
        } else {
          payload.text = msg;
          payload.textMessage = { text: msg };
        }

        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVO_KEY
          },
          body: JSON.stringify(payload)
        }).catch(err => console.error("Erro fetch WhatsApp:", err));
      }
    }

    return new Response(JSON.stringify({ success: true, videoUrl: finalVideoUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
