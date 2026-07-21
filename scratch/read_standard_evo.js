import fs from 'fs';
const content = fs.readFileSync('scratch/standard_evo_output.json', 'utf16le');
// Find the start of the JSON array, skipping the dotenv prefix [dotenv...]
const match = content.match(/\[\r?\n\s+\{/);
const startIndex = match ? match.index : -1;
if (startIndex !== -1) {
    const jsonStr = content.substring(startIndex);
    try {
        const instances = JSON.parse(jsonStr);
        console.log(`Parsed ${instances.length} instances:`);
        instances.forEach((item, index) => {
            if (item.instance) {
                console.log(`${index}: [Format A] Name: ${item.instance.instanceName}, ID: ${item.instance.instanceId}, Status: ${item.instance.status}`);
            } else {
                console.log(`${index}: [Format B] Name: ${item.name}, ID: ${item.id}, Status: ${item.connectionStatus || item.status}, Token: ${item.token}`);
            }
        });
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
    }
} else {
    console.error('JSON array start not found');
}
