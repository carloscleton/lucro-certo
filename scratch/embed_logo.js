const fs = require('fs');
const path = require('path');

const base64Path = path.join(__dirname, '..', 'public', 'nfse-logo-base64.txt');
const apiIndexPath = path.join(__dirname, '..', 'api', 'index.ts');

if (!fs.existsSync(base64Path)) {
    console.error('Base64 logo file not found!');
    process.exit(1);
}

if (!fs.existsSync(apiIndexPath)) {
    console.error('api/index.ts not found!');
    process.exit(1);
}

const logoBase64 = fs.readFileSync(base64Path, 'utf8').trim();
let apiIndexContent = fs.readFileSync(apiIndexPath, 'utf8');

// We want to replace the logo loading block in api/index.ts with the embedded base64 logo.
// Let's locate the try-catch block we just inserted.

const target = `    // Logotipo Oficial Sefin Nacional NFS-e (Imagem PNG de alta resolução enviada pelo usuário)
    try {
        let b64Logo = '';
        const logoPath = path.join(process.cwd(), 'public', 'nfse-logo.png');
        if (fs.existsSync(logoPath)) {
            b64Logo = \`data:image/png;base64,\${fs.readFileSync(logoPath).toString('base64')}\`;
        }
        if (b64Logo) {
            doc.addImage(b64Logo, 'PNG', margin + 3, y + 2.5, 46, 13);
        } else {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(46, 139, 87);
            doc.text('NFS-e', margin + 3, y + 11);
        }
    } catch (imgErr: any) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(46, 139, 87);
        doc.text('NFS-e', margin + 3, y + 11);
    }`;

const replacement = `    // Logotipo Oficial Sefin Nacional NFS-e (Imagem PNG de alta resolução incorporada diretamente)
    const NFSE_LOGO_EMBEDDED = 'data:image/png;base64,${logoBase64}';
    try {
        doc.addImage(NFSE_LOGO_EMBEDDED, 'PNG', margin + 3, y + 2.5, 46, 13);
    } catch (imgErr: any) {
        console.warn('Erro ao desenhar logotipo PNG incorporado:', imgErr.message);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(46, 139, 87);
        doc.text('NFS-e', margin + 3, y + 11);
    }`;

if (apiIndexContent.includes(target)) {
    apiIndexContent = apiIndexContent.replace(target, replacement);
    fs.writeFileSync(apiIndexPath, apiIndexContent, 'utf8');
    console.log('Successfully embedded logo base64 in api/index.ts!');
} else {
    // If already replaced or slightly different, print a warning or handle replacement
    console.warn('Could not find target logo block in api/index.ts. Checking if already embedded...');
    if (apiIndexContent.includes('NFSE_LOGO_EMBEDDED')) {
        console.log('NFSE_LOGO_EMBEDDED already present in api/index.ts!');
    } else {
        console.error('Target block not found. Please review api/index.ts manually.');
    }
}
