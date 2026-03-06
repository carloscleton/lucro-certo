import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuick() {
    console.log('--- Ativando Automação Temporariamente para Empresa ---');

    // Buscar qualquer empresa para forçar ativação
    const { data: companies } = await supabase.from('companies').select('id, trade_name, settings').limit(1);

    if (!companies || companies.length === 0) {
        console.error('Nenhuma empresa encontrada.');
        return;
    }

    const company = companies[0];
    const originalSettings = company.settings;

    // Ativa aniversário para o teste
    console.log(`Ativando em ${company.trade_name}...`);
    await supabase.from('companies').update({
        settings: { ...originalSettings, automation_birthday_reminders: true }
    }).eq('id', company.id);

    // Agora tenta rodar o teste
    console.log('--- Criando contato de teste ---');
    const today = new Date();
    // Ajustar para evitar problemas de fuso no banco
    const todayStr = today.toISOString().split('T')[0];
    const targetPhone = '5584998071213';

    const { data: member } = await supabase.from('company_members').select('user_id').eq('company_id', company.id).limit(1).single();
    if (!member) return console.error('Sem membro');

    const { data: contact } = await supabase
        .from('contacts')
        .insert([{
            name: 'Teste Carlos',
            phone: targetPhone,
            birthday: todayStr,
            user_id: member.user_id,
            type: 'client'
        }])
        .select()
        .single();

    if (!contact) return console.error('Erro contato');

    console.log(`Contato ${contact.id} criado. Chamando função...`);

    try {
        const fetchRes = await fetch(`${supabaseUrl}/functions/v1/birthday-reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ company_id: company.id })
        });
        const resText = await fetchRes.text();
        console.log('Resposta da Função:', resText);

        // Limpeza
        console.log('--- Limpando ---');
        await supabase.from('contacts').delete().eq('id', contact.id);
        await supabase.from('companies').update({ settings: originalSettings }).eq('id', company.id);
    } catch (e) {
        console.error(e);
    }
}

testQuick();
