import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function run() {
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .ilike('name', '%Alexandre%')
    
    if (error) {
        console.error("Error querying contacts:", error)
        return
    }
    
    console.log("Contacts found:", JSON.stringify(contacts, null, 2))
}

run()
