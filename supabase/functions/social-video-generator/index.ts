import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações do Google Cloud
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000)
  // Ensure private key has correct newline format
  const formattedKey = serviceAccount.private_key.replace(/\\n/g, '\n')
  const privateKey = await jose.importPKCS8(formattedKey, 'RS256')

  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  })

  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { post_id, company_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let videoResult = "https://www.w3schools.com/html/mov_bbb.mp4"; // Placeholder rabbit video

    let profile = null;

    if (GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.log("GOOGLE_SERVICE_ACCOUNT_JSON detectado. Iniciando autenticação...");
      const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON)

      // 1. Fetch Post and Profile separately to avoid join issues
      const { data: post, error: postErr } = await supabase
        .from('social_posts')
        .select('*')
        .eq('id', post_id)
        .single()

      if (postErr || !post) {
        console.error("Erro ao buscar post no banco:", postErr);
        throw new Error(`Post ${post_id} não encontrado.`);
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('social_profiles')
        .select('*')
        .eq('company_id', post.company_id)
        .single()

      if (profileErr || !profileData) {
        console.error("Erro ao buscar perfil da empresa:", profileErr);
        throw new Error("Perfil da empresa não encontrado.");
      }

      profile = profileData
      const script = post.content

      console.log(`[Diagnostic] Projeto Google: ${serviceAccount.project_id}`);
      console.log(`[Diagnostic] Gerando áudio para o roteiro (${script.length} caracteres)`);

      // 2. Obter Token do Google
      let accessToken;
      try {
        accessToken = await getAccessToken(serviceAccount)
        console.log("Token do Google obtido com sucesso.");
      } catch (authErr: any) {
        console.error("Erro na Autenticação Google (Verifique a Private Key):", authErr);
        throw authErr;
      }

      // 3. Google Cloud Text-to-Speech (Gerar Áudio)
      const voiceName = profile?.avatar_gender === 'female' ? 'pt-BR-Neural2-A' : 'pt-BR-Neural2-B'
      console.log(`[Diagnostic] Chamando TTS com voz: ${voiceName}`);

      const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: { text: script },
          voice: { languageCode: "pt-BR", name: voiceName },
          audioConfig: { audioEncoding: "MP3" }
        })
      })

      const ttsData = await ttsRes.json()
      if (!ttsData.audioContent) {
        console.error("Erro no Google TTS. Resposta:", JSON.stringify(ttsData));
        throw new Error(`Falha ao gerar áudio TTS: ${ttsData.error?.message || "Erro desconhecido"}`);
      }
      console.log("Áudio gerado com sucesso pelo Google TTS.");

      // 4. Vertex AI Veo 3.1 (Gerar Vídeo com Avatar via LRO)
      const project = serviceAccount.project_id
      const location = "us-central1"
      const modelId = "veo-3.1-fast-generate-preview"
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`

      const brandInfo = profile?.brand_logo_url ? `with the company logo (${profile.brand_logo_url}) as a watermark` : '';
      const colorInfo = profile?.brand_primary_color ? `The color scheme of the scene should subtly incorporate the brand color ${profile.brand_primary_color}.` : '';

      const prompt = `A professional ${profile?.avatar_gender === 'male' ? 'man' : 'woman'} avatar in a ${profile?.avatar_style} setting, speaking naturally to the camera. High quality, realistic lip-sync, corporate social media video style. ${brandInfo} ${colorInfo}`;

      console.log(`[Diagnostic] Projeto: ${project} | Modelo: ${modelId} | Região: ${location}`);
      console.log(`[Diagnostic] Iniciando predictLongRunning para Veo 3.1...`);

      const veoRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
              audio_base64: ttsData.audioContent,
              aspect_ratio: "9:16"
            }
          ],
          parameters: {
            duration_seconds: 5, // Modelo FAST + 5s = Muito mais rápido
            sample_count: 1
          }
        })
      })

      const operationData = await veoRes.json()
      if (!veoRes.ok) {
        console.error("[Diagnostic] Erro ao iniciar LRO no Vertex:", JSON.stringify(operationData));
        throw new Error(`Vertex LRO Init Error: ${operationData.error?.message || "Erro desconhecido"}`);
      }

      const operationName = operationData.name;
      console.log(`[Diagnostic] Operação iniciada: ${operationName}. Aguardando conclusão...`);

      // Polling Loop otimizado (30 segundos totais no máximo para garantir folga no timeout de 60s do servidor)
      let done = false;
      let pollingAttempts = 0;
      const maxAttempts = 15; // 15 * 2s = 30s
      let finalResponse = null;

      while (!done && pollingAttempts < maxAttempts) {
        pollingAttempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s

        console.log(`[Diagnostic] Polling #${pollingAttempts} (T+${pollingAttempts * 2}s)...`);
        const pollRes = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${operationName}`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!pollRes.ok) {
          console.warn(`[Diagnostic] Polling falhou (${pollRes.status}), tentando novamente...`);
          continue;
        }

        const pollData = await pollRes.json();
        if (pollData.done) {
          done = true;
          finalResponse = pollData;
          console.log("[Diagnostic] Operação de vídeo concluída!");
        }
      }

      if (!done || !finalResponse.response) {
        throw new Error("A geração do vídeo demorou demais ou falhou. Tente novamente em alguns instantes.");
      }

      const videoResultData = finalResponse.response;
      const receivedVideo = videoResultData.predictions?.[0]?.video_url || videoResultData.predictions?.[0]?.content || videoResultData.predictions?.[0]?.gcsUri;

      if (receivedVideo) {
        videoResult = receivedVideo;
        console.log("URL do vídeo recebida do LRO com sucesso.");
      } else {
        console.error("[Diagnostic] Estrutura inesperada do LRO (Sem vídeo no response):", JSON.stringify(finalResponse));
        throw new Error("Não foi possível encontrar a URL do vídeo na resposta final do Google.");
      }
    } else {
      console.error("ERRO CRÍTICO: GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
      throw new Error("SECRET_MISSING_GOOGLE_CREDENTIALS");
    }

    let videoUrl = videoResult;

    // 5. Salvar o vídeo no Supabase Storage
    try {
      if (videoResult !== "https://www.w3schools.com/html/mov_bbb.mp4") {
        const videoName = `video_${post_id}_${Date.now()}.mp4`
        const res = await fetch(videoResult)
        if (!res.ok) throw new Error(`Falha no fetch do vídeo: ${res.statusText}`)
        const videoBlob = await res.blob()

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('social_media_assets')
          .upload(`${company_id}/${videoName}`, videoBlob, {
            contentType: 'video/mp4',
            upsert: true
          })

        if (uploadErr) throw uploadErr

        const { data: publicUrlData } = supabase.storage
          .from('social_media_assets')
          .getPublicUrl(`${company_id}/${videoName}`)

        videoUrl = publicUrlData.publicUrl
      }
    } catch (storageErr: any) {
      console.error("Aviso: Falha ao salvar no Storage, manteremos a URL original:", storageErr.message);
    }

    // 6. Atualizar o Post com a URL final
    await supabase.from('social_posts')
      .update({ image_url: videoUrl, media_type: 'reels' })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ success: true, videoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error("Erro no social-video-generator:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
