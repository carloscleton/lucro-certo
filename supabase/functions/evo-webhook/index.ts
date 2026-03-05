import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações e Client do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

const API_VERSION = 'v19.0'

// Helper: enviar mensagem via Evolution API
async function sendWhatsApp(instanceName: string, targetNumber: string, text: string) {
  await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
    body: JSON.stringify({
      number: targetNumber,
      options: { delay: 1200, presence: "composing" },
      text,
      textMessage: { text }
    })
  })
}

// Helper: publicar um post no Instagram
async function publishToInstagram(post: any, igAccountId: string, fbAccessToken: string): Promise<boolean> {
  try {
    const isVideo = post.image_url?.toLowerCase().endsWith('.mp4') || post.image_url?.toLowerCase().endsWith('.mov') || post.media_type === 'reels';

    let mediaUrl = `https://graph.facebook.com/${API_VERSION}/${igAccountId}/media?access_token=${fbAccessToken}&caption=${encodeURIComponent(post.content || '')}`;

    if (isVideo) {
      mediaUrl += `&media_type=REELS&video_url=${encodeURIComponent(post.image_url)}`;
    } else {
      mediaUrl += `&image_url=${encodeURIComponent(post.image_url)}`;
      if (post.media_type === 'story') {
        mediaUrl += `&media_type=STORIES`;
      }
    }

    const mediaRes = await fetch(mediaUrl, { method: 'POST' })
    const mediaData = await mediaRes.json()

    if (mediaData.error || !mediaData.id) {
      console.error('Erro ao criar container:', mediaData.error)
      return false
    }

    // Para vídeos, esperar processamento
    if (isVideo) {
      await new Promise(resolve => setTimeout(resolve, 15000))
    }

    const publishUrl = `https://graph.facebook.com/${API_VERSION}/${igAccountId}/media_publish?creation_id=${mediaData.id}&access_token=${fbAccessToken}`
    const publishRes = await fetch(publishUrl, { method: 'POST' })
    const publishData = await publishRes.json()

    if (publishData.error || !publishData.id) {
      console.error('Erro ao publicar:', publishData.error)
      return false
    }

    // Atualizar status no banco
    await supabase.from('social_posts').update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      media_id: publishData.id
    }).eq('id', post.id)

    console.log(`Post ${post.id} publicado no IG com id: ${publishData.id}`)
    return true
  } catch (err) {
    console.error(`Erro ao publicar post ${post.id}:`, err)
    return false
  }
}

serve(async (req) => {
  try {
    let payload = await req.json()
    console.log("Evo Webhook Payload recebido:", JSON.stringify(payload).substring(0, 200))

    // Gravar log bruto
    try {
      await supabase.from('evo_webhook_logs').insert({ payload: payload })
    } catch (err) {
      console.error('Erro ao gravar log bruto', err)
    }

    if (Array.isArray(payload)) {
      payload = payload[0]
    }

    const eventName = payload?.event || payload?.event?.type || '';

    if (eventName !== 'messages.upsert' && eventName !== 'MESSAGES_UPSERT') {
      return new Response('Evento ignorado: ' + eventName, { status: 200 })
    }

    let data = payload?.data || payload
    let instance = payload?.instance || 'unknown'

    if (!data || !data.key) {
      return new Response('Payload vazio', { status: 200 })
    }

    // Extrair texto da mensagem
    const msgObj = data.message
    const message = msgObj?.conversation || msgObj?.extendedTextMessage?.text || msgObj?.buttonsResponseMessage?.selectedDisplayText || ''
    const text = typeof message === 'string' ? message.trim().toUpperCase() : ''

    // Comandos reconhecidos
    const allowKeywords = ['SIM', 'S', 'APROVAR', 'APROVADO', 'POSTA', 'POSTAR', '1']
    const blockKeywords = ['NAO', 'NÃO', 'N', 'REPROVAR', 'DESCARTAR', '2']
    const viewKeywords = ['VER', 'REVISAR', 'DETALHE', 'DETALHES', '3']

    let action = ''
    if (allowKeywords.includes(text)) {
      action = 'approve'
    } else if (blockKeywords.includes(text)) {
      action = 'reject'
    } else if (viewKeywords.includes(text)) {
      action = 'view'
    } else {
      return new Response('Não é um comando de aprovação.', { status: 200 })
    }

    // Extrair número do remetente
    const remoteJid = data.key.remoteJidAlt || data.key.remoteJid || ''
    const senderPhone = remoteJid.split('@')[0]
    const fallbackJid = data.key.remoteJid || ''
    const fallbackPhone = fallbackJid.split('@')[0]

    // Localizar empresa pelo número do whatsapp
    const { data: profiles, error: profileErr } = await supabase
      .from('social_profiles')
      .select('company_id, approval_whatsapp, ig_account_id, fb_access_token')

    if (profileErr) throw profileErr

    const matchingProfiles = profiles?.filter(p => {
      if (!p.approval_whatsapp) return false;
      const savedNum = p.approval_whatsapp.replace(/\D/g, '');
      return senderPhone.endsWith(savedNum.slice(-8)) || savedNum.endsWith(senderPhone.slice(-8)) ||
        fallbackPhone.endsWith(savedNum.slice(-8)) || savedNum.endsWith(fallbackPhone.slice(-8));
    }) || []

    if (matchingProfiles.length === 0) {
      console.log('Nenhum perfil encontrado para:', senderPhone)
      return new Response('Perfil não encontrado', { status: 200 })
    }

    const companyIds = matchingProfiles.map(p => p.company_id)

    // Buscar TODAS as postagens pendentes (sem limite)
    const { data: pendingPosts, error: postsErr } = await supabase
      .from('social_posts')
      .select('*')
      .in('company_id', companyIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (postsErr) throw postsErr

    if (!pendingPosts || pendingPosts.length === 0) {
      if (instance) {
        await sendWhatsApp(instance, senderPhone, '🤔 Não encontrei nenhuma postagem pendente de aprovação no momento.')
      }
      return new Response('Sem post pendente', { status: 200 })
    }

    const totalPosts = pendingPosts.length

    // =============================================
    //  AÇÃO: VER (Revisar postagens individualmente)
    // =============================================
    if (action === 'view') {
      for (let i = 0; i < totalPosts; i++) {
        const p = pendingPosts[i]
        const caption = p.content ? p.content.substring(0, 150) + (p.content.length > 150 ? '...' : '') : '(Sem legenda)'
        const mediaIcon = p.media_type === 'story' ? '📱' : p.media_type === 'reels' ? '🎬' : '📸'
        const detailMsg = `${mediaIcon} *Postagem ${i + 1} de ${totalPosts}*\n\n*Tipo:* ${p.media_type?.toUpperCase()}\n*Legenda:*\n${caption}\n\n*Imagem:* ${p.image_url || '(Sem imagem)'}`
        await sendWhatsApp(instance, senderPhone, detailMsg)
        // Pequeno delay entre mensagens
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      const finalMsg = `📋 Essas são as *${totalPosts} postagens pendentes*.\n\nAgora responda:\n*1* → Aprovar e postar TODAS\n*NAO* → Descartar todas`
      await sendWhatsApp(instance, senderPhone, finalMsg)
      return new Response('Posts enviados para revisão', { status: 200 })
    }

    // =============================================
    //  AÇÃO: APROVAR TODAS
    // =============================================
    if (action === 'approve') {
      // Aprovar todas no banco
      const postIds = pendingPosts.map(p => p.id)
      await supabase.from('social_posts').update({ status: 'approved' }).in('id', postIds)

      // Enviar confirmação
      await sendWhatsApp(instance, senderPhone, `✅ *${totalPosts} postagem(ns) aprovada(s)!*\n\nPublicando no Instagram agora... Cada postagem será publicada com um intervalo de segurança. Aguarde a confirmação! ⏳`)

      // Publicar cada post com intervalo
      const profileInfo = matchingProfiles.find(p => p.company_id === pendingPosts[0].company_id)

      if (profileInfo && profileInfo.ig_account_id && profileInfo.fb_access_token) {
        let publicadas = 0
        let falhas = 0

        for (let i = 0; i < totalPosts; i++) {
          const post = pendingPosts[i]

          // Intervalo entre publicações (10 seg para a primeira, 30 seg entre as seguintes)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 30000))
          }

          const success = await publishToInstagram(post, profileInfo.ig_account_id, profileInfo.fb_access_token)
          if (success) {
            publicadas++
          } else {
            falhas++
            await supabase.from('social_posts').update({ status: 'failed' }).eq('id', post.id)
          }
        }

        // Mensagem final de resultado
        let resultMsg = ''
        if (falhas === 0) {
          resultMsg = `🎉 *Missão Cumprida!*\n\n✅ Todas as *${publicadas} postagens* foram publicadas com sucesso no Instagram!\n\nAcesse seu perfil para conferir! 📲`
        } else {
          resultMsg = `📊 *Resultado da Publicação:*\n\n✅ ${publicadas} publicada(s) com sucesso\n❌ ${falhas} falha(s)\n\nAs postagens com falha podem ser republicadas pelo Painel Web.`
        }
        await sendWhatsApp(instance, senderPhone, resultMsg)
      } else {
        await sendWhatsApp(instance, senderPhone, '⚠️ Posts aprovados, porém o perfil não tem integração com o Instagram ativa. Acesse o Painel Web para conectar.')
      }

      return new Response(JSON.stringify({ success: true, approved: totalPosts }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // =============================================
    //  AÇÃO: REJEITAR TODAS
    // =============================================
    if (action === 'reject') {
      const postIds = pendingPosts.map(p => p.id)
      await supabase.from('social_posts').update({ status: 'rejected' }).in('id', postIds)

      await sendWhatsApp(instance, senderPhone, `❌ *${totalPosts} postagem(ns) descartada(s).*\n\nNossa IA tentará gerar opções melhores no próximo ciclo! 🤖`)

      return new Response(JSON.stringify({ success: true, rejected: totalPosts }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response('OK', { status: 200 })
  } catch (e: any) {
    console.error('Erro geral no evo-webhook:', e)
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
