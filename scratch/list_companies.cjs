const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCompanies() {
    try {
        const { data, error } = await supabase.from('companies').select('*');
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Total companies:', data.length);
            console.log('Companies:', data.map(c => ({ id: c.id, name: c.name, cnpj: c.cnpj })));
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkCompanies();
