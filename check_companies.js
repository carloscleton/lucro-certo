const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('companies').select('id, trade_name').order('created_at', { ascending: true }).limit(5);
    console.log('First Companies:', JSON.stringify(data, null, 2));
}

check();
