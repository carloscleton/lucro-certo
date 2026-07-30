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
        console.log('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env', env);
        return;
    }

    try {
        console.log(`Querying instances table on ${supabaseUrl}...`);
        const res = await axios.get(`${supabaseUrl}/rest/v1/instances`, {
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            }
        });
        console.log('Instances in Database:');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
