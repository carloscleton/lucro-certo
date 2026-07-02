import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

console.log('Evolution API URL:', EVOLUTION_API_URL);

async function main() {
    const instanceName = 'SLIN2';
    try {
        console.log(`🗑️ Testing deletion of instance "${instanceName}"...`);
        const url = `${EVOLUTION_API_URL}/instance/delete/${encodeURIComponent(instanceName)}`;
        console.log(`URL: ${url}`);
        const response = await axios.delete(url, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });
        console.log('DELETE Success response:', response.status, response.data);
    } catch (e: any) {
        console.error('DELETE Error response:', e.status || e.response?.status, e.response?.data || e.message);
    }
}

main();
