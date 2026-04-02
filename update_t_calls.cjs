const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const keysToUpdate = [
    'settings.monthly_fee',
    'settings.annual_fee',
    'payments.amount_label',
    'loyalty.price_label',
    'common.currency_symbol'
];

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
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    keysToUpdate.forEach(key => {
        // Find t('key') and replace with t('key', { symbol: window.__CURRENCY_SYMBOL__ || 'R$' })
        // Need to be careful with both single and double quotes.
        
        const regex1 = new RegExp(`t\\('${key}'\\)`, 'g');
        const regex2 = new RegExp(`t\\("${key}"\\)`, 'g');
        const replacement = `t('${key}', { symbol: window.__CURRENCY_SYMBOL__ || 'R$' })`;

        content = content.replace(regex1, replacement);
        content = content.replace(regex2, replacement);
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log('Updated t() in:', file);
    }
});

console.log('Total files updated:', changedCount);
