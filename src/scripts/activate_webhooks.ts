import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co';
const supabaseKey = 'sb_publishable_n2LGLiHh8wMr7AcFVdzLqw_GZ9AJpgz';

const supabase = createClient(supabaseUrl, supabaseKey);

async function activateWebhooks() {
    console.log('🔍 Buscando webhooks inativos...\n');

    // Buscar todos os webhooks
    const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('*');

    if (error) {
        console.error('❌ Erro ao buscar webhooks:', error);
        return;
    }

    if (!webhooks || webhooks.length === 0) {
        console.log('⚠️  Nenhum webhook encontrado no banco de dados!');
        return;
    }

    console.log(`📋 Total de webhooks: ${webhooks.length}\n`);

    const inactiveWebhooks = webhooks.filter(w => !w.is_active);

    if (inactiveWebhooks.length === 0) {
        console.log('✅ Todos os webhooks já estão ativos!');
        return;
    }

    console.log(`⚠️  Encontrados ${inactiveWebhooks.length} webhook(s) inativo(s):\n`);

    inactiveWebhooks.forEach((webhook, index) => {
        console.log(`${index + 1}. ${webhook.name}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Eventos: ${webhook.events.join(', ')}`);
        console.log('');
    });

    console.log('🔄 Ativando todos os webhooks...\n');

    // Ativar todos os webhooks
    const { error: updateError } = await supabase
        .from('webhooks')
        .update({ is_active: true })
        .eq('is_active', false);

    if (updateError) {
        console.error('❌ Erro ao ativar webhooks:', updateError);
        return;
    }

    console.log('✅ Todos os webhooks foram ativados com sucesso!\n');

    // Verificar
    const { data: activeWebhooks } = await supabase
        .from('webhooks')
        .select('*')
        .eq('is_active', true);

    console.log(`✅ Total de webhooks ativos agora: ${activeWebhooks?.length || 0}\n`);

    if (activeWebhooks && activeWebhooks.length > 0) {
        console.log('📋 Webhooks ativos:');
        activeWebhooks.forEach((webhook, index) => {
            console.log(`${index + 1}. ${webhook.name} - Eventos: ${webhook.events.join(', ')}`);
        });
    }

    console.log('\n🎉 Pronto! Agora teste marcar um orçamento como enviado!');
}

activateWebhooks();
