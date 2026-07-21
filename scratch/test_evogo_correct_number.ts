import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5FD2DBE29232-9FCE-8CD1-500DC0E5F46D'; // New Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213'; // With 9!

const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iagogIDw8CiAgICAvVHlwZSAvQ2F0YWxvZwogICAgL1BhZ2VzIDIgMCBSagogID4+CmVuZG9iagoyIDAgb2JqCiAgPDwKICAgIC9UeXBlIC9QYWdlcwogICAgL0tpZHMgWzMgMCBSXQogICAgL0NvdW50IDEKICA+PgplbmRvYmoKMyAwIG9iagogIDw8CiAgICAvVHlwZSAvUGFnZQogICAgL1BhcmVudCAyIDAgUgogICAgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KICAgIC9SZXNvdXJjZXMgPDwKICAgICAgL0ZvbnQgPDwKICAgICAgICAvRjEgNCAwIFIKICAgICAgPj4KICAgID4+CiAgICAvQ29udGVudHMgNSAwIFIKICA+PgplbmRvYmoKNCAwIG9iagogIDw8CiAgICAvVHlwZSAvRm9udAogICAgL1N1YnR5cGUgL1R5cGUxCiAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iago1IDAgb2JqCiAgPDwKICAgIC9MZW5ndGggNDQKICA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcwIDcwMCBUZCAoTkZlLmlvIFNhbmRib3ggLSBOb3RhIFNpbXVsYWRhKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDgwIDAwMDAwIG4gCjAwMDAwMDAxNDMgMDAwMDAgbCAKMDAwMDAwMDMwMiAwMDAwMCBuIAowMDAwMDAwMzg0IDAwMDAwIG4gCnRyYWlsZXIKICA8PAogICAgL1NpemUgNgogICAgL1Jvb3QgMSAwIFIKICA+PgpzdGFydHhyZWYKNDc5CiUlRU9GCg==';

async function testGoBase64() {
    const url = `${EVOLUTION_GO_API_URL}/send/media`;
    console.log(`\n--- Test Evolution GO /send/media using Base64 (with 9) ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: mockPdfBase64,
            type: 'document',
            filename: 'NotaFiscal-GO-Com9.pdf',
            caption: 'Teste GO Base64 com 9 no número'
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

testGoBase64();
