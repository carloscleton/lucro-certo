const https = require('https');

https.get('https://docs.plugnotas.com.br/api.json', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const spec = JSON.parse(data);
            const path1 = spec.paths['/nfse/{idNotaOrProtocol}'];
            const path2 = spec.paths['/nfse/{idNotaOrProtocol} '];
            
            console.log('--- DETAILS FOR /nfse/{idNotaOrProtocol} ---');
            console.log(JSON.stringify(path1, null, 2));
            
            console.log('--- DETAILS FOR /nfse/{idNotaOrProtocol}  (with trailing space) ---');
            console.log(JSON.stringify(path2, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
