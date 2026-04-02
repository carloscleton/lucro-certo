const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filePath));
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            results.push(filePath);
        }
    });
    return results;
}

const files = walk(srcDir);
let changedFiles = 0;

const searchRegex = /new Intl\.NumberFormat\(['"]pt-BR['"],\s*\{\s*style:\s*['"]currency['"],\s*currency:\s*['"]BRL['"]\s*\}\)/g;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (searchRegex.test(content)) {
        // Replace with window.__getCurrencyFormat()
        // We will define this global function in main.tsx or App.tsx
        content = content.replace(searchRegex, `new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' })`);
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
        console.log('Updated:', file);
    }
});

console.log('Total files updated:', changedFiles);
