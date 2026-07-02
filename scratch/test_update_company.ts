import axios from 'axios'

async function testUpdateCompany() {
    const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio'.trim();
    const companyIdNfe = 'fec1854455894d6b8efe72a2ef6cd43a'.trim();

    try {
        console.log(`Trying PUT /v1/companies/${companyIdNfe} with certificate: null...`);
        const res = await axios({
            method: 'PUT',
            url: `https://api.nfe.io/v1/companies/${companyIdNfe}`,
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            data: {
                certificate: null
            }
        });
        console.log('Success PUT null:', res.status, JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Error PUT null:', err.response?.status, err.response?.data || err.message);
    }

    try {
        console.log(`Trying PUT /v1/companies/${companyIdNfe} with empty certificate...`);
        const res = await axios({
            method: 'PUT',
            url: `https://api.nfe.io/v1/companies/${companyIdNfe}`,
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            data: {
                certificate: {}
            }
        });
        console.log('Success PUT empty:', res.status, JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Error PUT empty:', err.response?.status, err.response?.data || err.message);
    }
}

testUpdateCompany();
