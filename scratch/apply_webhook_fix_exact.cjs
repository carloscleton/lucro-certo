const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'api', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `          // 4. Automação de WhatsApp (apenas se foi autorizado/concluído, tiver PDF e a empresa estiver configurada para envio automático)
          if (mappedStatus === 'concluido' && finalPdfUrl && invoice.company_id) {
              triggerWhatsAppNotificationHelper(invoice.id, finalPdfUrl, invoice_number ? String(invoice_number) : '', mappedStatus, authHeader);
          }`;

const replacementStr = `          // 4. Automação de WhatsApp (apenas se foi autorizado/concluído e a empresa estiver configurada para envio automático)
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
          }`;

// Let's normalize carriage returns to ensure perfect match
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    const newContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced webhook trigger in api/index.ts");
} else {
    // If it still doesn't match, let's search for a smaller unique substring in that block
    const uniqueTarget = `if (mappedStatus === 'concluido' && finalPdfUrl && invoice.company_id) {\n              triggerWhatsAppNotificationHelper(invoice.id, finalPdfUrl, invoice_number ? String(invoice_number) : '', mappedStatus, authHeader);\n          }`;
    const normalizedUnique = uniqueTarget.replace(/\r\n/g, '\n');
    
    if (normalizedContent.includes(normalizedUnique)) {
        const uniqueReplacement = `if (mappedStatus === 'concluido' && invoice.company_id) {\n              let resolvedPdfUrl = finalPdfUrl;\n              if (!resolvedPdfUrl) {\n                  const protocol = req.headers['x-forwarded-proto'] || req.protocol;\n                  const host = req.get('host');\n                  const baseApiUrl = \`\${protocol}://\${host}\`;\n                  const usedType = invoice.type || 'nfse';\n                  resolvedPdfUrl = \`\${baseApiUrl}/api/fiscal-module/\${usedType}/\${invoice.id}/pdf?companyId=\${invoice.company_id}\`;\n              }\n              triggerWhatsAppNotificationHelper(invoice.id, resolvedPdfUrl, invoice_number ? String(invoice_number) : '', mappedStatus, authHeader);\n          }`;
        const newContent = normalizedContent.replace(normalizedUnique, uniqueReplacement.replace(/\r\n/g, '\n'));
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log("Successfully replaced webhook trigger using unique target");
    } else {
        console.error("Could not find target block in api/index.ts");
    }
}
