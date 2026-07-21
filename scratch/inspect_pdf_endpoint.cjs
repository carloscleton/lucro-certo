const https = require('https');

https.get('https://docs.plugnotas.com.br/api.json', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const spec = JSON.parse(data);
            const pathInfo = spec.paths['/nfse/pdf/{idNota}'];
            console.log('--- DETAILS FOR /nfse/pdf/{idNota} ---');
            console.log(JSON.stringify(pathInfo, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
