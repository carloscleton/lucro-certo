import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // Assuming I can access it from env?

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'labfacilsuporte@gmail.com')
        .single()
    
    console.log(JSON.stringify({ data, error }, null, 2))
}

check()
