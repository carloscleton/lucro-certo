const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function savePdfs() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    
    // 1. Municipal note
    const idMuni = '6a2d70e4498706327e033ee5';
    console.log(`Downloading PDF for municipal note ${idMuni}...`);
    try {
        const resMuni = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/pdf/${idMuni}`, {
            headers: { 'x-api-key': apiKey },
            responseType: 'arraybuffer'
        });
        fs.writeFileSync(path.join(__dirname, 'municipal.pdf'), resMuni.data);
        console.log(`Saved municipal.pdf, size: ${resMuni.data.length} bytes`);
    } catch (e) {
        console.error("Muni PDF error:", e.message);
    }

    // 2. National note
    const idNac = '6a2d729eb9c93ec394e8f3ca';
    console.log(`Downloading PDF for national note ${idNac}...`);
    try {
        const resNac = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/pdf/${idNac}`, {
            headers: { 'x-api-key': apiKey },
            responseType: 'arraybuffer'
        });
        fs.writeFileSync(path.join(__dirname, 'nacional.pdf'), resNac.data);
        console.log(`Saved nacional.pdf, size: ${resNac.data.length} bytes`);
    } catch (e) {
        console.error("Nac PDF error:", e.message);
    }
}

savePdfs();
