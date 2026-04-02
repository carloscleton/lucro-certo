const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Settings.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix truncated strings
// Finding: t('some.key', { symbol: window.__CURRENCY_SYMBOL__ || 'R
// Replacing with: t('some.key', { symbol: window.__CURRENCY_SYMBOL__ || 'R$' })
content = content.replace(/t\(['"]([^'"]+)['"],\s*\{\s*symbol:\s*window\.__CURRENCY_SYMBOL__\s*\|\|\s*['"]R(?![^'"]*['"]\s*\)\s*\)})/g, "t('$1', { symbol: window.__CURRENCY_SYMBOL__ || 'R$' })");

// 2. Remove duplicated content
// We found that it ends at line 3777
const lines = content.split('\n');
if (lines.length > 5000) {
    // Find the last valid '}' for export function Settings
    let lastValidLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '}' && lines[i-1] && lines[i-1].trim() === ');' && lines[i-2] && lines[i-2].trim() === '}') {
             // This looks like the end of the return and component if it matches the pattern observed
        }
    }
    // Actually, I'll just look for line 3777 specifically if it looks like the end
    // From my previous view_file:
    // 3775:         </div >
    // 3776:     );
    // 3777: }
    if (lines[3776].trim() === '}' && lines[3775].trim() === ');') {
        content = lines.slice(0, 3777).join('\n');
        console.log('Truncated file to 3777 lines');
    } else {
        // Fallback: look for the first occurrence of line 30 export function Settings and the corresponding end
        console.log('Pattern not found at 3777 precisely, searching for first complete Settings component');
        // Let's try to find where it starts duplicating
        for (let i = 1000; i < lines.length - 1; i++) {
            if (lines[i].includes('export function Settings') && i > 30) {
                 content = lines.slice(0, i).join('\n');
                 console.log('Truncated at line', i);
                 break;
            }
        }
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Repair complete');
