import axios from 'axios';

const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio';
const companyId = '6A29AA2FE424F40E7CEDAFA2';

async function testV1() {
    try {
        console.log("--- Testing API v1 ---");
        const response = await axios.get('https://api.nfe.io/v1/companies', {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("V1 Companies:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("V1 Error:", e.response?.status, e.response?.data || e.message);
    }
}

async function testV2() {
    try {
        console.log("--- Testing API v2 ---");
        const response = await axios.get('https://api.nfe.io/v2/companies', {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("V2 Companies:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("V2 Error:", e.response?.status, e.response?.data || e.message);
    }
}

async function run() {
    await testV1();
    await testV2();
}

run();
