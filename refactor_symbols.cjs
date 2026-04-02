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

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We must use $$ to write a literal $ in the replace string.
    // Pattern 1: label="Something (R$)"
    content = content.replace(/label="([^"]*)\(R\$\)([^"]*)"/g, "label={`$1(${window.__CURRENCY_SYMBOL__ || 'R$$'})$2`}");
    
    // Pattern 2: placeholder="R$ 0,00"
    content = content.replace(/placeholder="R\$\s+([^"]+)"/g, "placeholder={`\\${window.__CURRENCY_SYMBOL__ || 'R$$'} $1`}");

    // Pattern 3: >R$ {value}<
    content = content.replace(/>R\$\s*\{([^}]+)\}</g, ">{window.__CURRENCY_SYMBOL__ || 'R$$'} {$1}<");

    // Pattern 4: tickFormatter={(value) => `R$ ${value}`}
    content = content.replace(/`R\$\s*\$\{([^}]+)\}`/g, "`\\${window.__CURRENCY_SYMBOL__ || 'R$$'} \\${$1}`");

    // Pattern 5: 'Valor (R$)' => `Valor (${window.__CURRENCY_SYMBOL__ || 'R$'})`
    // We only replace exact matches to avoid duplicating.
    content = content.replace(/'([^']*) \(R\$\)'/g, "`$1 (\\${window.__CURRENCY_SYMBOL__ || 'R$$'})`");
    content = content.replace(/"([^"]*) \(R\$\)"/g, "`$1 (\\${window.__CURRENCY_SYMBOL__ || 'R$$'})`");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
    }
});

console.log('Total files updated:', changedFiles);
