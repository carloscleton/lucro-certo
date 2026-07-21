import axios from 'axios'

async function test() {
    const url = 'https://evogo.idealzap.com.br/instance/all';
    const key = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
    try {
        const response = await axios.get(url, {
            headers: { 'apikey': key }
        });
        const list = response.data?.data || [];
        const cleton = list.find((i: any) => i.name === 'CLETON');
        console.log('CLETON full object:', JSON.stringify(cleton, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
