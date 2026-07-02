import axios from 'axios';

async function main() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    const cnpj = '00893566000190';
    console.log(`Querying period consultation from PlugNotas Sandbox for CNPJ: ${cnpj}...`);
    try {
        const response = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/nacional/${cnpj}/consultar/periodo`, {
            params: {
                dataInicial: '2026-06-01',
                dataFinal: '2026-06-30',
                ator: 1
            },
            headers: {
                'x-api-key': apiKey
            }
        });
        
        const data = response.data;
        const notes = data.documents || data.data || data;
        console.log(`Total notes found: ${notes?.length || 0}`);
        if (Array.isArray(notes)) {
            notes.forEach(note => {
                console.log(`- ID: ${note.id} | Status: ${note.status} | Num: ${note.numeroNfse || note.numero} | Date: ${note.rps?.dataEmissao || note.created_at} | Pattern: ${note.padrao || 'N/A'}`);
            });
        } else {
            console.log("Response data:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error fetching notes:", e.message, e.response?.data);
    }
}

main();
