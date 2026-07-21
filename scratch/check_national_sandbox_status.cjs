const axios = require('axios');
const fs = require('fs');

const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const baseUrl = 'https://api.sandbox.plugnotas.com.br';
const id = '6a4f90be44adc7e26565e1c8';

async function checkStatus() {
    try {
        console.log(`Checking status of note ${id}...`);
        const statusRes = await axios.get(`${baseUrl}/nfse/${id}`, {
            headers: { 'x-api-key': apiKey }
        });
        console.log('Status Response:', JSON.stringify(statusRes.data, null, 2));

        if (statusRes.data.status === 'CONCLUIDO') {
            console.log(`Downloading PDF of note ${id}...`);
            const pdfRes = await axios.get(`${baseUrl}/nfse/pdf/${id}`, {
                headers: { 'x-api-key': apiKey },
                responseType: 'arraybuffer'
            });
            console.log('PDF Download Success! Size:', pdfRes.data.byteLength);
            fs.writeFileSync('c:/Projeto-antigravity/scratch/national_test.pdf', pdfRes.data);
            console.log('PDF saved to scratch/national_test.pdf');
        } else {
            console.log('Note is not CONCLUIDO yet.');
        }
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

checkStatus();
