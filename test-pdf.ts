import pdfParse from 'npm:pdf-parse@1.1.1'
import { Buffer } from "node:buffer"

const url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const response = await fetch(url);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

try {
    const data = await pdfParse(buffer);
    console.log("Success! Extracted text:", data.text);
} catch (e) {
    console.error("Error:", e);
}
