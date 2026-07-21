const https = require('https');

https.get('https://docs.plugnotas.com.br/api.json', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const spec = JSON.parse(data);
            const getMethod = spec.paths['/nfse/pdf/{idNota}'].get;
            console.log('--- GET /nfse/pdf/{idNota} ---');
            console.log(JSON.stringify(getMethod, null, 2).substring(0, 1500));
        } catch (e) {
            console.error('Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
