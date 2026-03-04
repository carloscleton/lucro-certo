const API_KEY = 'AIzaSyB3Kt6T5QGPS7xrLrADHas1EBZZtNF978o';

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    }
}

listModels();
