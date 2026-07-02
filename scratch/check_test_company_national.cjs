const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://api.sandbox.plugnotas.com.br/empresa/08187168000160', {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
            }
        });
        console.log("NFSe Config of Test Company:", JSON.stringify(response.data.nfse?.config || {}, null, 2));
    } catch (e) {
        console.error("ERROR MESSAGE:", e.message);
    }
}

test();
