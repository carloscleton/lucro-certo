import axios from 'axios';

const apiKey = '15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio';
const ibgeCode = '9999999'; // Non-existent/uncovered city

async function testPrefecture() {
    try {
        console.log("--- Testing Prefecture API ---");
        const response = await axios.get(`https://prefectures-dev.api.nfe.io/v1/prefectures/${ibgeCode}`, {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("Error:", e.response?.status, e.response?.data || e.message);
    }
}

testPrefecture();
