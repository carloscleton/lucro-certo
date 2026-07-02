import axios from 'axios'

async function testDeleteEndpoints() {
    const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio'.trim();
    const companyIdNfe = 'fec1854455894d6b8efe72a2ef6cd43a'.trim();

    const urls = [
        { method: 'DELETE', url: `https://api.nfe.io/v1/companies/${companyIdNfe}/certificate` },
        { method: 'DELETE', url: `https://api.nfe.io/v1/companies/${companyIdNfe}/certificates` },
        { method: 'DELETE', url: `https://api.nfse.io/v1/companies/${companyIdNfe}/certificate` },
        { method: 'DELETE', url: `https://api.nfe.io/v2/companies/${companyIdNfe}/certificate` },
        { method: 'DELETE', url: `https://api.nfe.io/v2/companies/${companyIdNfe}/certificates` },
    ];

    for (const item of urls) {
        try {
            console.log(`Trying ${item.method} ${item.url}...`);
            const res = await axios({
                method: item.method as any,
                url: item.url,
                headers: { 'Authorization': apiKey }
            });
            console.log(`SUCCESS:`, res.status, res.data);
        } catch (err: any) {
            console.error(`ERROR:`, err.response?.status, err.response?.data || err.message);
        }
    }
}

testDeleteEndpoints();
