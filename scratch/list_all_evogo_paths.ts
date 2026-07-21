import axios from 'axios';

async function listPaths() {
    try {
        const response = await axios.get('https://evogo.idealzap.com.br/swagger/doc.json');
        const paths = Object.keys(response.data.paths);
        console.log('ALL PATHS IN EVOGO SWAGGER:');
        console.log(paths.sort());
    } catch (err: any) {
        console.error(err.message);
    }
}

listPaths();
