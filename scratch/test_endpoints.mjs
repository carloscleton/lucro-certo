import axios from 'axios';
import FormData from 'form-data';

const apiKey = "15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio";
const companyId = "fec1854455894d6b8efe72a2ef6cd43a";

// We don't have a real PFX buffer, but we can send a mock buffer to see if the endpoint is 404 or something else
const mockBuffer = Buffer.from("dummy cert content");

async function testEndpoint(url) {
    console.log(`\nTesting endpoint: ${url}`);
    const form = new FormData();
    form.append('File', mockBuffer, {
        filename: 'certificado.pfx',
        contentType: 'application/x-pkcs12'
    });
    form.append('Password', '123456');

    try {
        const response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': apiKey
            },
            timeout: 10000
        });
        console.log("SUCCESS:", response.status, response.data);
    } catch (e) {
        console.log("ERROR status:", e.response?.status);
        console.log("ERROR data:", e.response?.data);
    }
}

async function main() {
    // Test api.nfe.io singular
    await testEndpoint(`https://api.nfe.io/v2/companies/${companyId}/certificate`);
    // Test api.nfse.io plural
    await testEndpoint(`https://api.nfse.io/v2/companies/${companyId}/certificates`);
}

main();
