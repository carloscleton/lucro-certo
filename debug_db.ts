import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function check() {
    const { data: posts, error: postErr } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

    console.log("--- ULTIMOS POSTS ---")
    console.log(JSON.stringify(posts, null, 2))

    const { data: instances, error: instErr } = await supabase
        .from('instances')
        .select('*')
        .eq('status', 'connected')

    console.log("--- INSTANCIAS CONECTADAS ---")
    console.log(JSON.stringify(instances, null, 2))

    const { data: profiles, error: profErr } = await supabase
        .from('social_profiles')
        .select('*')
        .limit(1)

    console.log("--- EXEMPLO DE PERFIL ---")
    console.log(JSON.stringify(profiles, null, 2))
}

check()
