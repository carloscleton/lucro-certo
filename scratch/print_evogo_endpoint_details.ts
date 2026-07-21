import axios from 'axios'

async function test() {
    const url = 'https://evogo.idealzap.com.br/swagger/doc.json';
    try {
        const response = await axios.get(url);
        const paths = response.data.paths;
        console.log('=== Details for /send/button ===');
        console.log(JSON.stringify(paths['/send/button'], null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
