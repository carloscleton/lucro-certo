import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log("Iniciando rotina de publicação de posts agendados...")
    
    // 1. Buscar posts pendentes com data de agendamento <= hoje
    // Como a data é salva com "YYYY-MM-DD", comparamos com o dia atual em UTC-3 (ou similar)
    // Para simplificar, pegamos todos com scheduled_for <= NOW em UTC
    const today = new Date().toISOString().split('T')[0]
    
    const { data: pendingPosts, error: fetchErr } = await supabase
      .from('social_posts')
      .select('id, company_id')
      .eq('status', 'pending')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', today)
      .limit(10) // Processamos 10 por vez para não estourar o timeout

    if (fetchErr) throw fetchErr

    if (!pendingPosts || pendingPosts.length === 0) {
      console.log("Nenhum post agendado para processar no momento.")
      return new Response(JSON.stringify({ success: true, message: "No posts to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    console.log(`Processando ${pendingPosts.length} posts agendados...`)
    const results = []

    for (const post of pendingPosts) {
      console.log(`Disparando publicação para o Post ID: ${post.id}...`)
      try {
        // Chamamos a função social-post-publisher para cada post
        // Usamos fetch pois cada execução leva ~50 segundos
        // FIRE AND FORGET (não aguardamos o resultado para não travar o loop e nem dar timeout no cron)
        fetch(`${supabaseUrl}/functions/v1/social-post-publisher`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: post.id })
        }).catch(e => console.error(`Erro ao disparar publisher para o post ${post.id}:`, e))
        
        results.push({ post_id: post.id, status: 'dispatched' })
      } catch (err) {
        console.error(`Erro ao processar post ${post.id}:`, err)
        results.push({ post_id: post.id, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Erro fatal no Scheduler Cron:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})

// Cron Trigger (Deno) - Executa a cada 2 horas (Horários de pico são bons, ou mais frequente)
// No Supabase, se você tiver o plano Pro, o Deno.cron funcionará automaticamente ao fazer o deploy.
// Para testar manualmente, chame a URL da função via Postman ou Dashboard.
if (typeof (Deno as any).cron === 'function') {
  (Deno as any).cron('Publish Scheduled Social Posts', '0 9,14,19 * * *', async () => {
    // Roda as 06:00, 11:00 e 16:00 (Horário BRT aproximado)
    console.log("Scheduler disparado via Deno Cron Engine");
    // Chamamos a própria URL via fetch para gatilhar o processamento HTTP
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    await fetch(`${supabaseUrl}/functions/v1/social-scheduler-cron`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}` }
    }).catch(e => console.error("Erro via Cron Engine:", e))
  })
}
