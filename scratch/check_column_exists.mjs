import fs from 'fs';
import path from 'path';
import axios from 'axios';

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.log('.env file not found');
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            env[key] = val;
        }
    });
    return env;
}

async function check() {
    const env = loadEnv();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const anonKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        console.log('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
        return;
    }

    try {
        console.log(`Checking if is_default column exists in instances table...`);
        const res = await axios.get(`${supabaseUrl}/rest/v1/instances?select=id,is_default&limit=1`, {
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            }
        });
        console.log('SUCCESS! Column is_default exists. Data:', res.data);
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data?.message || err.message);
    }
}

check();
