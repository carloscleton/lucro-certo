import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações e Client do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

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

    await supabase.from('social_posts').update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      media_id: publishData.id
    }).eq('id', post.id)

    return true
  } catch (err) {
    console.error(`Erro ao publicar post ${post.id}:`, err)
    return false
  }
}

serve(async (req) => {
  try {
    let payload = await req.json()
    console.log("Webhook Recebido:", JSON.stringify(payload).substring(0, 150))

    if (Array.isArray(payload)) payload = payload[0]

    const eventName = payload?.event || payload?.event?.type || '';
    if (!['messages.upsert', 'MESSAGES_UPSERT'].includes(eventName)) {
      return new Response('OK', { status: 200 })
    }

    const data = payload?.data || payload
    const instance = payload?.instance || 'unknown'

    if (!data?.key || data.key.fromMe) return new Response('Ignorado (Mensagem própria)', { status: 200 })

    // 1. Identificar Remetente
    const remoteJid = data.key.remoteJidAlt || data.key.remoteJid || ''
    const senderPhone = remoteJid.split('@')[0]

    // 2. Localizar Empresa pela Instância
    const { data: instanceInfo } = await supabase
      .from('instances')
      .select('company_id')
      .eq('instance_name', instance)
      .maybeSingle()

    const companyId = instanceInfo?.company_id

    // 3. LOGICA LEAD RADAR: Detectar resposta de lead prospectado
    if (companyId) {
      const { data: leadMatch } = await supabase
        .from('radar_leads')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('status', 'approached')
        .filter('metadata->>contact_number', 'eq', senderPhone)
        .limit(1)
        .maybeSingle()

      if (leadMatch) {
        await supabase.from('radar_leads').update({
          status: 'converted',
          updated_at: new Date().toISOString()
        }).eq('id', leadMatch.id)

        console.log(`Conversão Detectada: Lead ${leadMatch.name} de empresa ${companyId} respondeu!`)
        // O usuário verá no contador de 'Conversões/Agendamentos'
      }
    }

    // 4. LOGICA SOCIAL COPILOT: Comandos de Aprovação
    const msgObj = data.message
    const messageContent = msgObj?.conversation || msgObj?.extendedTextMessage?.text || msgObj?.buttonsResponseMessage?.selectedDisplayText || ''
    const text = typeof messageContent === 'string' ? messageContent.trim().toUpperCase() : ''

    const allowKeywords = ['SIM', 'S', 'APROVAR', 'APROVADO', 'POSTA', 'POSTAR', '1']
    const blockKeywords = ['NAO', 'NÃO', 'N', 'REPROVAR', 'DESCARTAR', '2']
    const viewKeywords = ['VER', 'REVISAR', 'DETALHE', 'DETALHES', '3']

    let action = ''
    if (allowKeywords.includes(text)) action = 'approve'
    else if (blockKeywords.includes(text)) action = 'reject'
    else if (viewKeywords.includes(text)) action = 'view'

    if (!action) return new Response('Mensagem comum (não é comando)', { status: 200 })

    // Localizar perfis da empresa para aprovação
    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('company_id, approval_whatsapp, ig_account_id, fb_access_token')

    const matchingProfiles = profiles?.filter(p => {
      if (!p.approval_whatsapp) return false;
      const savedNum = p.approval_whatsapp.replace(/\D/g, '');
      return senderPhone.endsWith(savedNum.slice(-8)) || savedNum.endsWith(senderPhone.slice(-8));
    }) || []

    if (matchingProfiles.length === 0) return new Response('Perfil não autorizado', { status: 200 })

    const companyIds = matchingProfiles.map(p => p.company_id)

    // Buscar postagens pendentes
    const { data: pendingPosts } = await supabase
      .from('social_posts')
      .select('*')
      .in('company_id', companyIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (!pendingPosts?.length) {
      await sendWhatsApp(instance, senderPhone, '🤔 Não encontrei postagens pendentes de aprovação.')
      return new Response('Sem posts', { status: 200 })
    }

    const totalPosts = pendingPosts.length

    if (action === 'view') {
      for (let i = 0; i < totalPosts; i++) {
        const p = pendingPosts[i]
        const mediaIcon = p.media_type === 'story' ? '📱' : p.media_type === 'reels' ? '🎬' : '📸'
        const detailMsg = `${mediaIcon} *Postagem ${i + 1} de ${totalPosts}*\n\n*Tipo:* ${p.media_type?.toUpperCase()}\n*Legenda:*\n${p.content || ''}\n\n*Imagem:* ${p.image_url || '(S/I)'}`
        await sendWhatsApp(instance, senderPhone, detailMsg)
        await new Promise(r => setTimeout(r, 1500))
      }
      await sendWhatsApp(instance, senderPhone, `📋 Responda:\n*1* → Aprovar e postar TODAS\n*2* → Descartar todas`)
    } else if (action === 'approve') {
      await supabase.from('social_posts').update({ status: 'approved' }).in('id', pendingPosts.map(p => p.id))
      await sendWhatsApp(instance, senderPhone, `✅ *${totalPosts} postagem(ns) aprovada(s)!* Publicando agora...`)

      const profile = matchingProfiles.find(p => p.company_id === pendingPosts[0].company_id)
      if (profile?.ig_account_id) {
        let ok = 0, errCount = 0
        for (let i = 0; i < totalPosts; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 20000))
          const success = await publishToInstagram(pendingPosts[i], profile.ig_account_id, profile.fb_access_token!)
          if (success) ok++
          else {
            errCount++
            await supabase.from('social_posts').update({ status: 'failed' }).eq('id', pendingPosts[i].id)
          }
        }
        await sendWhatsApp(instance, senderPhone, `📊 Fim: ${ok} sucesso(s) e ${errCount} falha(s).`)
      }
    } else if (action === 'reject') {
      await supabase.from('social_posts').update({ status: 'rejected' }).in('id', pendingPosts.map(p => p.id))
      await sendWhatsApp(instance, senderPhone, `❌ *${totalPosts} postagem(ns) descartada(s).*`)
    }

    return new Response('OK', { status: 200 })
  } catch (e: any) {
    console.error('Erro Webhook:', e)
    return new Response(e?.message, { status: 500 })
  }
})
