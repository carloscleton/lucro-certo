import axios from 'axios';

const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio';
const companyId = 'fec1854455894d6b8efe72a2ef6cd43a';

async function testCompanyV1() {
    try {
        console.log("--- Testing Company V1 ---");
        const response = await axios.get(`https://api.nfe.io/v1/companies/${companyId}`, {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("V1 Company details:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("V1 Error:", e.response?.status, e.response?.data || e.message);
    }
}

async function testCompanyV2() {
    try {
        console.log("--- Testing Company V2 ---");
        const response = await axios.get(`https://api.nfe.io/v2/companies/${companyId}`, {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("V2 Company details:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("V2 Error:", e.response?.status, e.response?.data || e.message);
    }
}

async function run() {
    await testCompanyV1();
    await testCompanyV2();
}

run();
