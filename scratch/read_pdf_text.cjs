const fs = require('fs');
const path = require('path');

// Let's use a simpler method since pdfjs-dist ESM in Node can be tricky.
// We can just search for raw ASCII strings inside the PDF buffer using RegExp or simple index search,
// or write a quick parser. Since PDFs are partially compressed, we can check for uncompressed strings like "/Title", "/Author", or "Maringa", etc.
// Let's read the files and check if "Maringa" or "Belo Horizonte" or "Bento" appears.

function searchStrings(filename) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`${filename} does not exist`);
        return;
    }
    const buffer = fs.readFileSync(filePath);
    const contentStr = buffer.toString('binary');
    
    console.log(`=== Searching inside ${filename} ===`);
    const terms = ['Maringa', 'Bento', 'Belo Horizonte', 'Nacional', 'Prestador', 'Tomador', 'Recebemos', 'Tecnospeed'];
    terms.forEach(term => {
        const count = (contentStr.match(new RegExp(term, 'gi')) || []).length;
        console.log(`- '${term}': ${count} occurrences`);
    });
}

searchStrings('municipal.pdf');
searchStrings('nacional.pdf');
