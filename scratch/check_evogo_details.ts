import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function checkDetails() {
    try {
        const response = await axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY
            }
        });
        const instances = response.data?.data || [];
        const instance = instances.find((i: any) => i.name === 'CCFERNANDES');
        console.log('INSTANCE CCFERNANDES DETAILS:');
        console.log(JSON.stringify(instance, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

checkDetails();
