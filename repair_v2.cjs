const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Settings.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the FIRST set of closing braces that look like the end of the component
for (let i = 0; i < lines.length - 3; i++) {
    if (lines[i].includes('</div >') && 
        lines[i+1].trim() === ');' && 
        lines[i+2].trim() === '}') {
        
        console.log('Found likely end of component at line', i+3);
        content = lines.slice(0, i+3).join('\n');
        break;
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Truncation complete');
