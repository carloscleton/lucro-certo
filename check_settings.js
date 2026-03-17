const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    console.log('App Settings:', JSON.stringify(data, null, 2));
    console.log('Error:', error);
}

check();
