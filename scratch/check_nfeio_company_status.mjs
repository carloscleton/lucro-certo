import axios from 'axios';

const apiKey = "15jiSV3l8SkohzeY0Kj43KIEKhhwuWGCIAmsO2d5vzBt6NaU4WHQDgccPnV9W0aEzio";
const companyId = "fec1854455894d6b8efe72a2ef6cd43a";

async function main() {
    try {
        const response = await axios.get(`https://api.nfe.io/v1/companies/${companyId}`, {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log("NFE.IO COMPANY DETAILS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

main();
