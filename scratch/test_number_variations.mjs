import axios from 'axios';

async function trySend(number, label) {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '9262020A2978-72EF-E807-6F519976F425';

    try {
        console.log(`[${label}] Trying to send message to ${number}...`);
        const res = await axios.post(`${url}/message/sendText/${instanceName}`, {
            number: number,
            text: `Teste de envio (${label}) pelo script de depuração para o número ${number}.`
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[${label}] SUCCESS:`, res.data);
    } catch (err) {
        console.log(`[${label}] FAILED:`, err.response?.status, err.response?.data || err.message);
    }
}

async function run() {
    // Variation 1: With the 9th digit
    await trySend('5584998071213', 'Com o 9');

    // Variation 2: Without the 9th digit
    await trySend('558498071213', 'Sem o 9');
}

run();
