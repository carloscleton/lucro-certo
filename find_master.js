const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', 'carloscleton.nat@gmail.com').single();
    if (profile) {
        const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', profile.id).eq('role', 'owner').single();
        if (members) {
            console.log('Master Company ID:', members.company_id);
            const { data: gateways } = await supabase.from('company_payment_gateways').select('*').eq('company_id', members.company_id);
            console.log('Master Gateways count:', gateways?.length || 0);
        }
    }
}

check();
