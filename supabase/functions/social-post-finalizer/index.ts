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

    // 1. Buscar Perfil
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (!profile) throw new Error("Perfil não encontrado.")

    // 2. Criar o Post (Imediato)
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

    // 3. DISPARAR PROCESSAMENTO EM BACKGROUND (Sem await para ser instantâneo!)
    console.log(`[Diagnostic] Disparando pipeline para o post ${post.id}`);

    // Chamada de fogo-e-esquecimento
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ post_id: post.id, company_id: company_id })
    }).catch(e => console.error("Erro disparador background:", e));

    return new Response(JSON.stringify({ success: true, post_id: post.id, message: "Processamento iniciado!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Erro Fatal no Finalizer:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
