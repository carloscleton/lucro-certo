import axios from 'axios';

async function check() {
    try {
        const response = await axios.get('https://api.sandbox.plugnotas.com.br/empresa/08187168000160', {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d',
                'Accept': 'application/json'
            }
        });
        console.log("PlugNotas Sandbox Company 08187168000160 Config:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

check();
