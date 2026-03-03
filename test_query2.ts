import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking profiles...");
    const { data: profiles } = await supabase.from('social_profiles').select('approval_whatsapp');
    console.log("Profiles:", profiles);

    // Simulate what the webhook does
    const senderPhone = '55848071213' // user's phone, wait, the user's phone might be "5584998071213" 

    const profile = profiles?.find(p => {
        if (!p.approval_whatsapp) return false;
        const savedNum = p.approval_whatsapp.replace(/\D/g, '');
        console.log("Comparing senderPhone:", '5584998071213', "with savedNum:", savedNum);
        return '5584998071213'.endsWith(savedNum.slice(-8)) || savedNum.endsWith('5584998071213'.slice(-8));
    });
    console.log("Matched profile:", profile);
}

main();
