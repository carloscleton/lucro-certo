import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { proposalId, action } = await req.json()

    if (!proposalId || !action) {
      throw new Error('Proposal ID and Action are required')
    }

    // 1. Fetch Proposal Data
    const { data: quote, error: fetchError } = await supabaseClient
      .from('quotes')
      .select('*, contact:contact_id(*), company:company_id(*)')
      .eq('id', proposalId)
      .single()

    if (fetchError || !quote) throw new Error('Proposal not found')

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // 2. Update Quote Status
    const { error: updateQuoteError } = await supabaseClient
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', proposalId)

    if (updateQuoteError) throw updateQuoteError

    // 3. Logic for Approval
    if (action === 'approve') {
      // 3.1 Update CRM Deal if linked
      if (quote.deal_id) {
        await supabaseClient
          .from('crm_deals')
          .update({ status: 'won' })
          .eq('id', quote.deal_id)
      }

      // 3.2 Create Finance Transaction
      const { error: txError } = await supabaseClient
        .from('transactions')
        .insert([{
          user_id: quote.user_id,
          company_id: quote.company_id,
          contact_id: quote.contact_id,
          description: `Ref. Proposta: ${quote.title}`,
          amount: quote.total_amount,
          type: 'income',
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          quote_id: quote.id,
          deal_id: quote.deal_id
        }])

      if (txError) console.error('Error creating transaction:', txError)
    }

    // 4. Send WhatsApp Notification to the Owner
    // We need the owner's WhatsApp from company settings or profile
    const { data: settings } = await supabaseClient
        .from('company_settings')
        .select('whatsapp_number, notification_enabled')
        .eq('company_id', quote.company_id)
        .single()

    if (settings?.notification_enabled && settings?.whatsapp_number) {
        const message = action === 'approve' 
            ? `🚀 *BOAS NOTÍCIAS!* O cliente *${quote.contact.name}* acaba de aprovar a proposta: *${quote.title}*.\n\n💰 Valor: R$ ${quote.total_amount.toLocaleString('pt-BR')}\n📈 O negócio no CRM foi movido para GANHO.`
            : `📉 *ATUALIZAÇÃO:* O cliente *${quote.contact.name}* declinou a proposta: *${quote.title}*.`

        // Send via Evolution API (assuming there's a utility or we call the internal proxy)
        // For simplicity, we can invoke the existing crm-agenda-notifier logic or call Evo direct
        try {
            await supabaseClient.functions.invoke('crm-agenda-notifier', {
                body: { 
                    overrideMessage: message,
                    targetPhone: settings.whatsapp_number,
                    companyId: quote.company_id
                }
            })
        } catch (err) {
            console.error('Error sending notification:', err)
        }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
