const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCNPJ() {
    try {
        const { data, error } = await supabase.from('companies').select('cnpj').limit(5);
        if (error) {
            console.error('Error in query:', error);
        } else {
            console.log('CNPJs in DB:', data.map(c => c.cnpj));
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkCNPJ();
