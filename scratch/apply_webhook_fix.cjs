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

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced webhook trigger in api/index.ts");
} else {
    // try with normalized line endings
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
    const normalizedReplacement = replacementStr.replace(/\r\n/g, '\n');
    
    if (normalizedContent.includes(normalizedTarget)) {
        const newContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log("Successfully replaced webhook trigger after normalizing line endings");
    } else {
        console.error("Could not find targetStr in api/index.ts");
    }
}
