import axios from 'axios';

async function testUrl() {
    const urls = [
        'https://waha.idealzap.com.br',
        'http://waha.idealzap.com.br',
        'https://waha.lucrocerto.com',
        'https://waha.lucrocerto.com.br'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing: ${url}...`);
            const res = await axios.get(url, { timeout: 3000 });
            console.log(`REACHABLE: ${url} -> Status: ${res.status}`);
        } catch (err) {
            console.log(`UNREACHABLE: ${url} -> ${err.message}`);
        }
    }
}

testUrl();
