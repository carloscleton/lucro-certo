import fs from 'fs';
const content = fs.readFileSync('scratch/standard_evo_output.json', 'utf16le');
console.log(content.substring(0, 1500));
