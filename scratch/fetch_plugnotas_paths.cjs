const https = require('https');

https.get('https://docs.plugnotas.com.br/api.json', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const spec = JSON.parse(data);
            console.log('--- PATHS MATCHING ---');
            const paths = Object.keys(spec.paths || {});
            for (const p of paths) {
                if (p.includes('nacional') || p.includes('nfse')) {
                    console.log(p);
                    const methods = Object.keys(spec.paths[p]);
                    for (const m of methods) {
                        const op = spec.paths[p][m];
                        console.log(`  ${m.toUpperCase()}: ${op.operationId} (summary: ${op.summary}, tags: ${op.tags?.join(', ')})`);
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error fetching spec:', e.message);
});
