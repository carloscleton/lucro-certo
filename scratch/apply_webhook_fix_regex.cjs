const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'api', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Match the comment and the complete if block
const regex = /\/\/\s*4\.\s*Automação\s+de\s+WhatsApp\s+\([\s\S]*?\}\s*?\}\s*?\}/;
const match = content.match(regex);

if (match) {
    console.log("Matched content:", match[0]);
    const replacementStr = `// 4. Automação de WhatsApp (apenas se foi autorizado/concluído e a empresa estiver configurada para envio automático)
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
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced webhook trigger via regex");
} else {
    console.error("Could not match regex in api/index.ts");
}
