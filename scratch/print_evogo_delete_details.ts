import axios from 'axios';

async function printDeleteDetails() {
    try {
        const response = await axios.get('https://evogo.idealzap.com.br/swagger/doc.json');
        const path = response.data.paths['/instance/delete/{instanceId}'];
        console.log('=== Details for DELETE /instance/delete/{instanceId} ===');
        console.log(JSON.stringify(path, null, 2));
    } catch (err: any) {
        console.error(err.message);
    }
}

printDeleteDetails();
