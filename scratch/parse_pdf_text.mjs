import fs from 'fs';
import path from 'path';
import * as pdfjs from 'pdfjs-dist';

async function extractText(filename) {
    const filePath = path.join('scratch', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`${filename} does not exist`);
        return;
    }
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    console.log(`\n=== ${filename} (${pdf.numPages} pages) ===`);
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => item.str).join(' ');
        console.log(`Page ${i} text:`);
        console.log(textItems.substring(0, 1000)); // Print first 1000 chars
    }
}

async function main() {
    try {
        await extractText('municipal.pdf');
        await extractText('nacional.pdf');
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
