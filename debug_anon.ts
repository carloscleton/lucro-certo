import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugTables() {
    console.log('--- Debugando Tabelas ---');
    const { data: companies, error: compErr } = await supabase.from('companies').select('*');
    console.log('Empresas:', companies?.length || 0);
    if (compErr) console.error('Erro Empresas:', compErr);

    const { data: members, error: membErr } = await supabase.from('company_members').select('*');
    console.log('Membros:', members?.length || 0);
    if (membErr) console.error('Erro Membros:', membErr);

    const { data: instances, error: instErr } = await supabase.from('instances').select('*');
    console.log('Instâncias:', instances?.length || 0);
}

debugTables();
