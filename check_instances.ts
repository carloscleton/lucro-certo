import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const { data: instances, error } = await supabase
    .from('instances')
    .select('instance_name, status, phone_number, company_id')
    .eq('status', 'connected')

if (error) {
    console.error(error)
    Deno.exit(1)
}

console.log(JSON.stringify(instances, null, 2))
