import axios from 'axios';

async function searchMessages() {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '9262020A2978-72EF-E807-6F519976F425';
    const remoteJid = '5584998071213@s.whatsapp.net';

    try {
        console.log(`Searching messages for chat: ${remoteJid}...`);
        const res = await axios.post(`${url}/chat/findMessages/${instanceName}`, {
            remoteJid: remoteJid,
            limit: 20
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        
        const records = res.data?.messages?.records || res.data?.records || [];
        console.log(`Found ${records.length} messages in chat log:`);
        for (const msg of records) {
            console.log(`- ID: ${msg.key?.id}, FromMe: ${msg.key?.fromMe}, Timestamp: ${msg.messageTimestamp}, Text: ${msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Mídia'}`);
        }
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

searchMessages();
