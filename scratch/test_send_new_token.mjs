import axios from 'axios';

async function trySend() {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '266CF273F93E-F597-45EE-D130C7C406FF';
    const number = '5521959189126'; // SLIN number

    try {
        console.log(`Trying to send message using token: ${token}...`);
        const res = await axios.post(`${url}/message/sendText/${instanceName}`, {
            number: number,
            text: 'Teste de envio (Token Novo) pelo script de depuração.'
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS:', res.data);
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

trySend();
