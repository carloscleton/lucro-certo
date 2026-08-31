const fs = require('fs');

const b64 = fs.readFileSync('public/nfse-logo.png').toString('base64');
let src = fs.readFileSync('api/index.ts', 'utf8');

if (src.includes('NFSE_LOGO_EMBEDDED')) {
    // Update existing embedded logo
    src = src.replace(
        /const NFSE_LOGO_EMBEDDED = 'data:image\/png;base64,[^']{10,}'/,
        "const NFSE_LOGO_EMBEDDED = 'data:image/png;base64," + b64 + "'"
    );
    console.log('Updated existing embedded logo. Length:', b64.length);
} else if (src.includes('Imagem PNG de alta resolucao')) {
    // Replace logo loading block with embedded logo
    const old = `    // Logotipo Oficial Sefin Nacional NFS-e (Imagem PNG de alta resolução incorporada diretamente)
    const NFSE_LOGO_EMBEDDED = 'data:image/png;base64,`;
    console.log('Block with embedded found, updating...');
} else {
    console.error('No logo block found!');
    process.exit(1);
}

fs.writeFileSync('api/index.ts', src, 'utf8');
console.log('Done!');
