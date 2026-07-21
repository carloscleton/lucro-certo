import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const INSTANCE_TOKEN = 'A4274803DD7B-98EC-1541-16B57333409C'; // Token for SLIN
const INSTANCE_NAME = 'SLIN';
const RECIPIENT = '558498071213';

const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iagogIDw8CiAgICAvVHlwZSAvQ2F0YWxvZwogICAgL1BhZ2VzIDIgMCBSagogID4+CmVuZG9iagoyIDAgb2JqCiAgPDwKICAgIC9UeXBlIC9QYWdlcwogICAgL0tpZHMgWzMgMCBSXQogICAgL0NvdW50IDEKICA+PgplbmRvYmoKMyAwIG9iagogIDw8CiAgICAvVHlwZSAvUGFnZQogICAgL1BhcmVudCAyIDAgUgogICAgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KICAgIC9SZXNvdXJjZXMgPDwKICAgICAgL0ZvbnQgPDwKICAgICAgICAvRjEgNCAwIFIKICAgICAgPj4KICAgID4+CiAgICAvQ29udGVudHMgNSAwIFIKICA+PgplbmRvYmoKNCAwIG9iagogIDw8CiAgICAvVHlwZSAvRm9udAogICAgL1N1YnR5cGUgL1R5cGUxCiAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iago1IDAgb2JqCiAgPDwKICAgIC9MZW5ndGggNDQKICA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcwIDcwMCBUZCAoTkZlLmlvIFNhbmRib3ggLSBOb3RhIFNpbXVsYWRhKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDgwIDAwMDAwIG4gCjAwMDAwMDAxNDMgMDAwMDAgbCAKMDAwMDAwMDMwMiAwMDAwMCBuIAowMDAwMDAwMzg0IDAwMDAwIG4gCnRyYWlsZXIKICA8PAogICAgL1NpemUgNgogICAgL1Jvb3QgMSAwIFIKICA+PgpzdGFydHhyZWYKNDc5CiUlRU9GCg==';

async function testSendBase64(withPrefix: boolean) {
    const url = `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(INSTANCE_NAME)}`;
    const mediaValue = withPrefix ? `data:application/pdf;base64,${mockPdfBase64}` : mockPdfBase64;
    console.log(`\n--- Test media send using Base64 (${withPrefix ? 'with prefix' : 'raw'}) ---`);
    try {
        const response = await axios.post(url, {
            number: RECIPIENT,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: `Teste Base64 ${withPrefix ? 'com prefixo' : 'sem prefixo'}`,
            media: mediaValue,
            fileName: 'NotaFiscal-Base64.pdf'
        }, {
            headers: {
                'apikey': INSTANCE_TOKEN,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log('Success!', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

async function main() {
    await testSendBase64(true);
    await testSendBase64(false);
}

main();
