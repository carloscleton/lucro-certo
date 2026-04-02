const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, 'src');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(projectDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Fix escaped template literals: \${ -> ${
    content = content.replace(/\\\$\{/g, '${');

    // 2. Fix hardcoded R$ in standard labels/strings
    // Search for patterns like: (R$), Valor R$, R$ 0,00, "R$ " + ...
    content = content.replace(/\(R\$\)/g, '(${window.__CURRENCY_SYMBOL__ || "R$"})');
    content = content.replace(/Valor R\$/g, 'Valor (${window.__CURRENCY_SYMBOL__ || "R$"})');
    
    // Fix literal "R$" string if it's not inside a t() call or already dynamic
    // This is tricky, but let's target specific common ones
    content = content.replace(/['"]R\$\s*['"]/g, '`${window.__CURRENCY_SYMBOL__ || "R$"}`');
    
    // Fix QuoteForm specifically if possible via generic rule
    content = content.replace(/\+ "R\$ " \+ /g, '+ (window.__CURRENCY_SYMBOL__ || "R$") + " " + ');

    // 3. Fix toLocaleString("pt-BR")
    content = content.replace(/\.toLocaleString\(['"]pt-BR['"]/g, '.toLocaleString(window.__CURRENCY_LOCALE__ || "pt-BR"');

    // 4. Fix specific t() shortcuts if missed
    // t('...', '... R$ ...')
    content = content.replace(/t\(['"]([^'"]+)['"],\s*['"]([^'"]*)R\$([^'"]*)['"]\)/g, (match, key, pre, post) => {
        return `t('${key}', { defaultValue: '${pre}' + (window.__CURRENCY_SYMBOL__ || 'R$') + '${post}', symbol: window.__CURRENCY_SYMBOL__ || 'R$' })`;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed', file);
    }
});
