const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'api', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

const normalizedContent = content.replace(/\r\n/g, '\n');

const startKeyword = "// 4. Automação de WhatsApp";
const endKeyword = "console.log(`   [WEBHOOK-UPDATE] Nota";

const startIndex = normalizedContent.indexOf(startKeyword);
const endIndex = normalizedContent.indexOf(endKeyword);

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const originalBlock = normalizedContent.substring(startIndex, endIndex);
    console.log("Found original block:\n", originalBlock);
    
    const replacementBlock = `// 4. Automação de WhatsApp (apenas se foi autorizado/concluído e a empresa estiver configurada para envio automático)
         if (mappedStatus === 'concluido' && invoice.company_id) {
             let resolvedPdfUrl = finalPdfUrl;
             if (!resolvedPdfUrl) {
                 const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                 const host = req.get('host');
                 const baseApiUrl = \`\${protocol}://\${host}\`;
                 const usedType = invoice.type || 'nfse';
                 resolvedPdfUrl = \`\${baseApiUrl}/api/fiscal-module/\${usedType}/\${invoice.id}/pdf?companyId=\${invoice.company_id}\`;
             }
             triggerWhatsAppNotificationHelper(invoice.id, resolvedPdfUrl, invoice_number ? String(invoice_number) : '', mappedStatus, authHeader);
         }
         
         `;
         
    const newContent = normalizedContent.replace(originalBlock, replacementBlock);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced block!");
} else {
    console.error(`Could not find start (${startIndex}) or end (${endIndex}) index.`);
}
