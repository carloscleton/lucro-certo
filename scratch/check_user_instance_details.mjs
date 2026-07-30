import axios from 'axios';

async function checkAllInstances() {
    const url = 'https://evo.idealzap.com.br';
    const apiKey = '7c4678985d13dfd7a89d4e56e7503563';

    try {
        console.log('Fetching all instances from Evolution server...');
        const res = await axios.get(`${url}/instance/fetchInstances`, {
            headers: { 'apikey': apiKey }
        });
        const instances = Array.isArray(res.data) ? res.data : [];
        console.log(`Found ${instances.length} instances on the server:`);
        
        for (const i of instances) {
            const instObj = i.instance || i;
            console.log(`----------------------------------------`);
            console.log(`Name:       ${instObj.name || instObj.instanceName}`);
            console.log(`ID:         ${instObj.id || instObj.instanceId}`);
            console.log(`Token:      ${instObj.token || instObj.apikey}`);
            console.log(`Status:     ${instObj.connectionStatus || instObj.status}`);
            console.log(`Number:     ${instObj.owner || instObj.number || 'N/A'}`);
        }
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

checkAllInstances();
