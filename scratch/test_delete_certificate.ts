import axios from 'axios'

async function testDelete() {
    const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio'.trim();
    const companyIdNfe = 'fec1854455894d6b8efe72a2ef6cd43a'.trim();
    const thumbprint = '20E2AD939B5DF0B782C2899A0073DB793CD9E9D0';

    // Try api.nfe.io first
    try {
        console.log(`Trying DELETE via api.nfe.io...`);
        const res = await axios({
            method: 'DELETE',
            url: `https://api.nfe.io/v2/companies/${companyIdNfe}/certificates/${thumbprint}`,
            headers: {
                'Authorization': apiKey
            }
        });
        console.log('Success api.nfe.io:', res.status, res.data);
    } catch (err: any) {
        console.error('Error api.nfe.io:', err.response?.status, err.response?.data || err.message);
    }

    // Try api.nfse.io second (if first fails or just to verify)
    try {
        console.log(`Trying DELETE via api.nfse.io...`);
        const res = await axios({
            method: 'DELETE',
            url: `https://api.nfse.io/v2/companies/${companyIdNfe}/certificates/${thumbprint}`,
            headers: {
                'Authorization': apiKey
            }
        });
        console.log('Success api.nfse.io:', res.status, res.data);
    } catch (err: any) {
        console.error('Error api.nfse.io:', err.response?.status, err.response?.data || err.message);
    }
}

testDelete();
