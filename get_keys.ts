import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
        console.error("Error:", error);
    } else if (data) {
        console.log("ASAAS_KEY:", data.platform_asaas_api_key);
        console.log("STRIPE_KEY:", data.platform_stripe_api_key);
        console.log("MP_KEY:", data.platform_mercadopago_api_key);
        console.log("STRIPE_PUB:", data.platform_stripe_publishable_key);
        console.log("MP_PUB:", data.platform_mercadopago_public_key);
    }
}

main();
