import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const { data, error } = await supabase
    .from('social_posts')
    .select('id, content, image_url, media_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

if (error) {
    console.error(error)
    Deno.exit(1)
}

console.log(JSON.stringify(data, null, 2))
