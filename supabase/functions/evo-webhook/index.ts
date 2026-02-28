import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações e Client do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

serve(async (req) => {
  try {
    let payload = await req.json()
    console.log("Evo Webhook Payload recebido:", JSON.stringify(payload).substring(0, 200))

    // Tentar gravar o log bruto no banco de dados para a gente conseguir ver (bypass RLS pq usa Service_Key)
    try {
      await supabase.from('evo_webhook_logs').insert({ payload: payload })
    } catch (err) {
      console.error('Erro ao gravar log bruto', err)
    }

    // Handle Evolution wrapping the payload in an array or different formats
    if (Array.isArray(payload)) {
      payload = payload[0]
    }

    const eventName = payload?.event || payload?.event?.type || '';

    // Validar se é um evento de nova mensagem
    if (eventName !== 'messages.upsert' && eventName !== 'MESSAGES_UPSERT') {
      return new Response('Evento ignorado: ' + eventName, { status: 200 })
    }

    let data = payload?.data || payload
    let instance = payload?.instance || 'unknown'

    if (!data || !data.key) {
      return new Response('Payload vazio', { status: 200 })
    }

    console.log("Recebendo msg payload:", JSON.stringify(data.message, null, 2))

    // Extrair o texto da mensagem
    const msgObj = data.message
    const message = msgObj?.conversation || msgObj?.extendedTextMessage?.text || msgObj?.buttonsResponseMessage?.selectedDisplayText || ''
    const text = typeof message === 'string' ? message.trim().toUpperCase() : ''

    // Palavras-chave que o usuário pode responder
    const allowKeywords = ['SIM', 'S', 'APROVAR', 'APROVADO', 'POSTA', 'POSTAR']
    const blockKeywords = ['NAO', 'NÃO', 'N', 'REPROVAR', 'DESCARTAR']

    let newStatus = ''
    let replyMsg = ''

    if (allowKeywords.includes(text)) {
      newStatus = 'approved'
      replyMsg = '✅ *Postagem APROVADA com sucesso!* 🚀\nEla já está na fila para ser publicada no seu Instagram/Meta em breve.'
    } else if (blockKeywords.includes(text)) {
      newStatus = 'rejected'
      replyMsg = '❌ *Postagem DESCARTADA.* Nossa inteligência tentará gerar opções melhores no próximo ciclo.'
    } else {
      // Se ele enviou um texto que não é comando de aprovação, ignoramos silenciosamente
      return new Response('Não é um comando de aprovação.', { status: 200 })
    }

    // Extrair o número de quem enviou
    // Ex: "5511999999999@s.whatsapp.net" -> "5511999999999"
    const remoteJid = data.key.remoteJidAlt || data.key.remoteJid || ''
    const senderPhone = remoteJid.split('@')[0]

    // Garantir que a gente tenha os dois para testar
    const fallbackJid = data.key.remoteJid || ''
    const fallbackPhone = fallbackJid.split('@')[0]

    // Localizar DE QUAL empresa é esse WhatsApp
    // Como os números salvos lá podem estar como "55 11 9...", vamos buscar todos e filtrar os dígitos
    const { data: profiles, error: profileErr } = await supabase
      .from('social_profiles')
      .select('company_id, approval_whatsapp')

    if (profileErr) throw profileErr

    const matchingProfiles = profiles?.filter(p => {
      if (!p.approval_whatsapp) return false;
      const savedNum = p.approval_whatsapp.replace(/\D/g, '');
      return senderPhone.endsWith(savedNum.slice(-8)) || savedNum.endsWith(senderPhone.slice(-8)) ||
        fallbackPhone.endsWith(savedNum.slice(-8)) || savedNum.endsWith(fallbackPhone.slice(-8));
    }) || []

    if (matchingProfiles.length === 0) {
      console.log('Nenhum perfil da IA encontrado para o telefone:', senderPhone)
      return new Response('Perfil não encontrado', { status: 200 })
    }

    const companyIds = matchingProfiles.map(p => p.company_id)

    // Buscar o post pendente mais recente dentre todas as empresas que ele gerencia
    const { data: pendingPosts, error: postsErr } = await supabase
      .from('social_posts')
      .select('*')
      .in('company_id', companyIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (postsErr) throw postsErr

    if (!pendingPosts || pendingPosts.length === 0) {
      console.log('Nenhum post PENDENTE encontrado para as empresas do celular:', senderPhone)

      // Enviar mensagem avisando que não tem post pendente
      try {
        if (instance) {
          await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
            body: JSON.stringify({
              number: senderPhone,
              textMessage: { text: '🤔 Não encontrei nenhuma postagem pendente de aprovação no momento.' }
            })
          })
        }
      } catch (err) { console.error(err) }

      return new Response('Sem post pendente', { status: 200 })
    }

    const post = pendingPosts[0]

    // 1. Atualizar o banco de dados para approved ou rejected!
    const { error: updateErr } = await supabase
      .from('social_posts')
      .update({ status: newStatus })
      .eq('id', post.id)

    if (updateErr) throw updateErr

    // 2. Enviar mensagem de confirmação de volta via Evolution API
    try {
      if (instance) {
        await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVO_API_KEY
          },
          body: JSON.stringify({
            number: senderPhone,
            options: { delay: 1000, presence: "composing" }, // Para parecer mais humano
            // Para parecer mais humano
            text: replyMsg,
            textMessage: { text: replyMsg }
          })
        })
      }
    } catch (err) {
      console.error('Falha ao enviar resposta de confirmação no wpp:', err)
    }

    // TODO: AQUI É ONDE SERÁ ACIONADA A API DO INSTAGRAM PARA POSTAR SE APROVADO!

    return new Response(JSON.stringify({ success: true, post_id: post.id, newStatus }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    console.error('Erro geral no evo-webhook:', e)
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
