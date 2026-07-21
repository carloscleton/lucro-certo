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

console.log("Supabase URL present:", !!env['SUPABASE_URL']);

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'],
    env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY']
);

async function run() {
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .ilike('name', '%Alexandre%');
    
    if (error) {
        console.error("Error querying contacts:", error);
        return;
    }
    
    console.log("Contacts found:", JSON.stringify(contacts, null, 2));
}

run();
