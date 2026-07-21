import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'C906C83B7FF4-9743-3BDA-704F835CCC90'; // Current Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213';

async function checkStatus() {
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, {
            headers: { 'apikey': 'fe079bb46dea5a9a0d08df7f2c9ff9ff' }
        });
        const instances = res.data?.data || [];
        const inst = instances.find((i: any) => i.name === INSTANCE_NAME);
        console.log(`[Status] Connected: ${inst?.connected}, JID: ${inst?.jid}`);
        return inst;
    } catch (err: any) {
        console.error('Status fetch error:', err.message);
        return null;
    }
}

async function sendMedia(index: number) {
    console.log(`\n--- Sending Message #${index} ---`);
    try {
        // Download dummy PDF
        const pdfRes = await axios.get('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', {
            responseType: 'arraybuffer'
        });
        const base64 = Buffer.from(pdfRes.data).toString('base64');

        const response = await axios.post(`${EVOLUTION_GO_API_URL}/send/media`, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: base64,
            type: 'document',
            filename: `NotaFiscal-GO-Double-${index}.pdf`,
            caption: `Envio duplo #${index}`
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log(`Success #${index}!`, response.data);
        return true;
    } catch (err: any) {
        console.error(`Error #${index} Status:`, err.response?.status);
        console.error(`Error #${index} Detail:`, JSON.stringify(err.response?.data, null, 2) || err.message);
        return false;
    }
}

async function runDoubleSend() {
    console.log('1. Checking status before send...');
    await checkStatus();

    console.log('\n2. Triggering first send...');
    const s1 = await sendMedia(1);

    console.log('\n3. Checking status after first send...');
    await checkStatus();

    if (s1) {
        console.log('\nWaiting 4 seconds...');
        await new Promise(resolve => setTimeout(resolve, 4000));

        console.log('\n4. Triggering second send...');
        await sendMedia(2);

        console.log('\n5. Checking status after second send...');
        await checkStatus();
    }
}

runDoubleSend();
