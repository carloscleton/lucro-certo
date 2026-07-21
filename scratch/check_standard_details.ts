import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const EVOLUTION_API_KEY = '7c4678985d13dfd7a89d4e56e7503563';

async function checkStandardDetails() {
    try {
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });
        const instances = Array.isArray(response.data) ? response.data : [];
        console.log('STANDARD EVOLUTION INSTANCES DETAILS:');
        instances.forEach((item: any) => {
            console.log(`- Name: ${item.name}, ID: ${item.id}, Status: ${item.connectionStatus}, JID: ${item.ownerJid}`);
        });
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

checkStandardDetails();
