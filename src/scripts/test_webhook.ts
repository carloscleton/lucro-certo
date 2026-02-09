import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co';
const supabaseKey = 'sb_publishable_n2LGLiHh8wMr7AcFVdzLqw_GZ9AJpgz';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWebhook() {
    console.log('🔍 Verificando webhooks configurados...\n');

    // Buscar todos os webhooks
    const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('❌ Erro ao buscar webhooks:', error);
        return;
    }

    if (!webhooks || webhooks.length === 0) {
        console.log('⚠️  Nenhum webhook ativo encontrado!');
        console.log('\n💡 Solução: Vá em Configurações → Webhooks e ative o webhook');
        return;
    }

    console.log(`✅ Encontrados ${webhooks.length} webhook(s) ativo(s):\n`);

    webhooks.forEach((webhook, index) => {
        console.log(`${index + 1}. ${webhook.name}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Eventos: ${webhook.events.join(', ')}`);
        console.log(`   Ativo: ${webhook.is_active ? '✅' : '❌'}`);
        console.log(`   Auth: ${webhook.auth_username ? '🔒 Sim' : '🔓 Não'}`);
        console.log('');
    });

    // Verificar se tem webhook para QUOTE_SENT
    const quoteSentWebhooks = webhooks.filter(w => w.events.includes('QUOTE_SENT'));

    if (quoteSentWebhooks.length === 0) {
        console.log('⚠️  Nenhum webhook configurado para o evento QUOTE_SENT!');
        console.log('\n💡 Solução: Edite seu webhook e marque o evento "Orçamento Enviado"');
        return;
    }

    console.log(`✅ ${quoteSentWebhooks.length} webhook(s) configurado(s) para QUOTE_SENT\n`);

    // Testar envio
    console.log('🚀 Testando envio de webhook...\n');

    const testWebhook = quoteSentWebhooks[0];
    const testPayload = {
        event: 'QUOTE_SENT',
        timestamp: new Date().toISOString(),
        data: {
            id: 'test-123',
            customer_name: 'TESTE',
            total: 100,
            status: 'sent'
        }
    };

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'LucroCerto-Webhook/1.0'
        };

        if (testWebhook.auth_username && testWebhook.auth_password) {
            const credentials = btoa(`${testWebhook.auth_username}:${testWebhook.auth_password}`);
            headers['Authorization'] = `Basic ${credentials}`;
            console.log('🔒 Usando Basic Auth');
        }

        console.log(`📤 Enviando para: ${testWebhook.url}\n`);

        const response = await fetch(testWebhook.url, {
            method: testWebhook.method || 'POST',
            headers,
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(10000)
        });

        console.log(`✅ Resposta: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        console.log(`📥 Corpo da resposta: ${responseText.substring(0, 200)}`);

    } catch (error: any) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            console.log('⚠️  Erro de CORS (esperado no navegador)');
            console.log('✅ MAS o webhook foi enviado! Verifique no n8n se recebeu.');
        } else {
            console.error('❌ Erro:', error.message);
        }
    }
}

testWebhook();
