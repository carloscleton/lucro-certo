import fs from 'fs';
import path from 'path';

function printKeys(filename: string) {
    const filePath = path.join('c:/Projeto-antigravity', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`${filename} does not exist.`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const keys = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0].trim());
    console.log(`=== Keys in ${filename} ===`);
    console.log(keys);
}

printKeys('.env');
printKeys('.env.local');
printKeys('.env.prod');
printKeys('.env.prod.local');
