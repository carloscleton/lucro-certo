import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, content } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (!profile) throw new Error("Perfil não encontrado.")

    // 1. Criar o Post imediatamente
    const { data: post, error: insertErr } = await supabase
      .from('social_posts')
      .insert({
        company_id,
        content,
        media_type: profile.video_enabled ? 'reels' : 'feed',
        status: 'pending'
      })
      .select().single()

    if (insertErr) throw insertErr

    // 2. Disparar Gerador de Vídeo em Segundo Plano (SEM ESPERAR)
    // Usamos o Edge Runtime para disparar e liberar o usuário
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ post_id: post.id, company_id: company_id })
    }).catch(e => console.error("Erro background trigger:", e))

    return new Response(JSON.stringify({ success: true, post_id: post.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
