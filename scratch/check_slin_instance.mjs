import axios from 'axios';

async function check() {
    const url = 'https://evo.idealzap.com.br';
    const apiKey = '7c4678985d13dfd7a89d4e56e7503563';
    const instanceName = 'SLIN';
    const techId = 'DEC54FF869FA-0DCF-8DED-902C2B4160BC';

    try {
        console.log(`Checking fetchInstances on Evolution API...`);
        const res = await axios.get(`${url}/instance/fetchInstances`, {
            headers: { 'apikey': apiKey }
        });
        const list = Array.isArray(res.data) ? res.data : [];
        console.log(`Total instances on Evolution API: ${list.length}`);
        const found = list.find(item => {
            const inst = item.instance || item;
            return inst.name?.toLowerCase() === instanceName.toLowerCase();
        });
        if (found) {
            console.log('Found instance SLIN on Evolution server:', JSON.stringify(found, null, 2));
        } else {
            console.log('SLIN instance NOT found by name.');
        }

        console.log(`Checking details directly using instance/connectionState/${instanceName}...`);
        const resState = await axios.get(`${url}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': apiKey }
        });
        console.log('Connection state for SLIN:', resState.data);

    } catch (err) {
        console.error('Error checking instance:', err.response?.status, err.response?.data || err.message);
    }
}

check();
