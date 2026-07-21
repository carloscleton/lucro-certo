import axios from 'axios'

async function test() {
    const url = 'https://evogo.idealzap.com.br/swagger/doc.json';
    try {
        const response = await axios.get(url);
        const defs = response.data.definitions;
        const buttonKey = 'github_com_EvolutionAPI_evolution-go_pkg_sendMessage_service.ButtonStruct';
        console.log('=== Definition for ButtonStruct ===');
        console.log(JSON.stringify(defs[buttonKey], null, 2));

        const keys = Object.keys(defs).filter(k => k.toLowerCase().includes('button'));
        console.log('\n=== Other Button-related definitions ===');
        for (const k of keys) {
            if (k !== buttonKey) {
                console.log(`- ${k}:`, JSON.stringify(defs[k], null, 2));
            }
        }
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
