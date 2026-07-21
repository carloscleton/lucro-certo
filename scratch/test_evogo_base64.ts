import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1';
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '558498071213';

const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iagogIDw8CiAgICAvVHlwZSAvQ2F0YWxvZwogICAgL1BhZ2VzIDIgMCBSagogID4+CmVuZG9iagoyIDAgb2JqCiAgPDwKICAgIC9UeXBlIC9QYWdlcwogICAgL0tpZHMgWzMgMCBSXQogICAgL0NvdW50IDEKICA+PgplbmRvYmoKMyAwIG9iagogIDw8CiAgICAvVHlwZSAvUGFnZQogICAgL1BhcmVudCAyIDAgUgogICAgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KICAgIC9SZXNvdXJjZXMgPDwKICAgICAgL0ZvbnQgPDwKICAgICAgICAvRjEgNCAwIFIKICAgICAgPj4KICAgID4+CiAgICAvQ29udGVudHMgNSAwIFIKICA+PgplbmRvYmoKNCAwIG9iagogIDw8CiAgICAvVHlwZSAvRm9udAogICAgL1N1YnR5cGUgL1R5cGUxCiAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iago1IDAgb2JqCiAgPDwKICAgIC9MZW5ndGggNDQKICA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcwIDcwMCBUZCAoTkZlLmlvIFNhbmRib3ggLSBOb3RhIFNpbXVsYWRhKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDgwIDAwMDAwIG4gCjAwMDAwMDAxNDMgMDAwMDAgbCAKMDAwMDAwMDMwMiAwMDAwMCBuIAowMDAwMDAwMzg0IDAwMDAwIG4gCnRyYWlsZXIKICA8PAogICAgL1NpemUgNgogICAgL1Jvb3QgMSAwIFIKICA+PgpzdGFydHhyZWYKNDc5CiUlRU9GCg==';

async function testGoBase64(withPrefix: boolean) {
    const url = `${EVOLUTION_GO_API_URL}/send/media`;
    const mediaValue = withPrefix ? `data:application/pdf;base64,${mockPdfBase64}` : mockPdfBase64;
    console.log(`\n--- Test Evolution GO /send/media using Base64 (${withPrefix ? 'with prefix' : 'raw'}) ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: mediaValue,
            type: 'document',
            filename: 'NotaFiscal-GO.pdf',
            caption: `Teste GO Base64 ${withPrefix ? 'com prefixo' : 'sem prefixo'}`
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
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
    await testGoBase64(true);
    await testGoBase64(false);
}

main();
