const fs = require('fs');
const path = require('path');

function printKeys(fileName) {
    const envPath = path.join(__dirname, '..', fileName);
    if (!fs.existsSync(envPath)) return;
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log(`--- Keys in ${fileName} ---`);
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            console.log(parts[0].trim());
        }
    });
}

printKeys('.env');
printKeys('.env.local');
printKeys('.env.prod');
printKeys('.env.prod.local');
