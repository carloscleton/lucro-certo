import axios from 'axios';

async function test() {
    try {
        const response = await axios.get('https://api.sandbox.plugnotas.com.br/empresa/08184315000104', {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
            }
        });
        console.log("SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR MESSAGE:", e.message);
        console.error("ERROR STATUS:", e.response?.status);
        console.error("ERROR DATA:", JSON.stringify(e.response?.data, null, 2));
    }
}

test();
