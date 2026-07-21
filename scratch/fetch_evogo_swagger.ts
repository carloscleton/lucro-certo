import axios from 'axios'

async function test() {
    const baseUrl = 'https://evogo.idealzap.com.br';
    const endpoints = [
        '/swagger/doc.json',
        '/swagger/json',
        '/swagger.json',
        '/api-docs',
        '/api-docs/swagger.json',
        '/swagger/index.html'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Checking ${baseUrl}${ep}...`);
            const response = await axios.get(`${baseUrl}${ep}`);
            console.log(`✅ Success on ${ep}! Status:`, response.status);
            if (ep.endsWith('.json')) {
                console.log('Keys in swagger JSON:', Object.keys(response.data));
                if (response.data.paths) {
                    console.log('Available paths:', Object.keys(response.data.paths).filter(p => p.includes('message')));
                }
            } else {
                console.log('HTML preview:', response.data.substring(0, 300));
            }
            break;
        } catch (err: any) {
            console.log(`❌ Fail on ${ep}:`, err.response?.status || err.message);
        }
    }
}

test();
