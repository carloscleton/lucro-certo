import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking columns...");
    const { data, error } = await supabase.from('social_posts').select('id, image_url').limit(1);
    console.log("Data:", data, "Error:", error);
}

main();
