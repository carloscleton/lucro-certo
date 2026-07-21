import axios from 'axios'

async function test() {
    const url = 'https://evogo.idealzap.com.br/swagger/doc.json';
    try {
        const response = await axios.get(url);
        const paths = Object.keys(response.data.paths || {});
        console.log('All paths defined in Evolution GO Swagger:');
        console.log(paths.sort());
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
