import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    try {
        console.log('1. Creating a temporary instance...');
        const createRes = await axios.post(`${EVOLUTION_GO_API_URL}/instance/create`, {
            name: 'TESTE_STATUS_TEMP',
            token: '12345678-ABCD-EF00-1234-567890ABCDEF',
            qrcode: true
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        const instanceId = createRes.data.data.id;
        const instanceToken = createRes.data.data.token;
        console.log(`Created: ID=${instanceId}, Token=${instanceToken}`);

        console.log('\n2. Fetching status with Instance Token...');
        const statusRes = await axios.get(`${EVOLUTION_GO_API_URL}/instance/status`, {
            headers: {
                'apikey': instanceToken
            }
        });
        console.log('Status Result:', statusRes.data);

        console.log('\n3. Fetching QR Code with Instance Token...');
        const qrRes = await axios.get(`${EVOLUTION_GO_API_URL}/instance/qr`, {
            headers: {
                'apikey': instanceToken
            }
        });
        console.log('QR Code Result:', qrRes.data);

        console.log('\n4. Deleting instance using Global API Key and ID...');
        const deleteRes = await axios.delete(`${EVOLUTION_GO_API_URL}/instance/delete/${instanceId}`, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY
            }
        });
        console.log('Delete Result:', deleteRes.data);
    } catch (error) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
    }
}

test();
