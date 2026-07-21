import axios from 'axios'

async function test() {
    const url = 'https://evogo.idealzap.com.br/instance/all';
    const key = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
    try {
        const response = await axios.get(url, {
            headers: { 'apikey': key }
        });
        const list = response.data?.data || [];
        console.log('Instances on Evolution GO:');
        console.log(list.map((i: any) => ({ id: i.id, name: i.name, status: i.status })));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
