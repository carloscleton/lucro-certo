import axios from 'axios'

async function testDeactivate() {
    const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio'.trim();
    const companyIdNfe = 'fec1854455894d6b8efe72a2ef6cd43a'.trim();

    try {
        console.log(`Trying PUT /v1/companies/${companyIdNfe} with status: 'Inactive'...`);
        const res = await axios({
            method: 'PUT',
            url: `https://api.nfe.io/v1/companies/${companyIdNfe}`,
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            data: {
                status: 'Inactive'
            }
        });
        console.log('Success PUT status Inactive:', res.status, JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Error PUT status Inactive:', err.response?.status, err.response?.data || err.message);
    }
}

testDeactivate();
