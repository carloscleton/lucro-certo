const fs = require('fs');
const path = require('path');

const env = {};

function loadEnvFile(fileName) {
    const envPath = path.join(__dirname, '..', fileName);
    if (!fs.existsSync(envPath)) return;
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            env[key] = val;
        }
    });
}

loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile('.env.prod');
loadEnvFile('.env.prod.local');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'],
    env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY']
);

async function run() {
    const { data: instances, error } = await supabase
        .from('instances')
        .select('*')
        .eq('company_id', '84d1586e-5d0c-456f-aa12-aefc5a9364a7');
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log("Instances for SERVICE LINE:", JSON.stringify(instances, null, 2));
}

run();
