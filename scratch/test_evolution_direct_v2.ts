import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const GLOBAL_KEY = '7c4678985d13dfd7a89d4e56e7503563';
const INSTANCE_TOKEN = 'A4274803DD7B-98EC-1541-16B57333409C'; // Token for SLIN
const INSTANCE_NAME = 'SLIN';

async function testSendText(number: string, text: string, apikey: string) {
    const url = `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log(`\nTesting sendText to ${number} using apikey: ${apikey.substring(0, 5)}...`);
    try {
        const response = await axios.post(url, {
            number: number,
            text: text,
            linkPreview: true
        }, {
            headers: {
                'apikey': apikey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('Success!', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

async function main() {
    const numberWith9 = '5584998071213';
    const numberWithout9 = '558498071213';

    console.log('=== TEST WITH GLOBAL KEY ===');
    await testSendText(numberWithout9, 'Teste com chave global (sem 9)', GLOBAL_KEY);

    console.log('=== TEST WITH INSTANCE TOKEN ===');
    await testSendText(numberWithout9, 'Teste com token da instancia (sem 9)', INSTANCE_TOKEN);
    await testSendText(numberWith9, 'Teste com token da instancia (com 9)', INSTANCE_TOKEN);
}

main();
