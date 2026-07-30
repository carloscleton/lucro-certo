import axios from 'axios';

async function testSendMedia(token, label) {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const number = '5521959189126'; // SLIN number
    const mediaUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    try {
        console.log(`[${label}] Trying sendMedia...`);
        const res = await axios.post(`${url}/message/sendMedia/${instanceName}`, {
            number: number,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: `Teste de mídia (${label})`,
            media: mediaUrl,
            fileName: 'Teste.pdf'
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[${label}] SUCCESS:`, res.data);
        return true;
    } catch (err) {
        console.log(`[${label}] FAILED:`, err.response?.status, err.response?.data || err.message);
        return false;
    }
}

async function run() {
    const globalKey = '7c4678985d13dfd7a89d4e56e7503563';
    const instanceToken = '9262020A2978-72EF-E807-6F519976F425';

    console.log('--- TEST 1: Global Key ---');
    await testSendMedia(globalKey, 'Global Key');

    console.log('\n--- TEST 2: Instance Token ---');
    await testSendMedia(instanceToken, 'Instance Token');
}

run();
