import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugTables() {
    console.log('--- Debugando Colunas ---');
    const { data: companies, error: compErr } = await supabase.from('companies').select('*').limit(1);
    if (companies && companies.length > 0) {
        console.log('Colunas Empresas:', Object.keys(companies[0]));
    } else {
        console.log('Nenhuma empresa encontrada ou erro:', compErr);
    }

    const { data: profiles, error: profErr } = await supabase.from('profiles').select('*').limit(1);
    if (profiles && profiles.length > 0) {
        console.log('Colunas Perfis:', Object.keys(profiles[0]));
    } else {
        console.log('Nenhum perfil encontrado ou erro:', profErr);
    }
}

debugTables();
