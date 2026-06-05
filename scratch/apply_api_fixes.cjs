const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'settings', 'FiscalSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Single search card - Layout
const singleLayoutTarget = `{tecnoSpeedCityInfo.padraoNacional?.producao || tecnoSpeedCityInfo.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}`;
const singleLayoutReplacement = `{tecnoSpeedCityInfo.padrao?.toLowerCase() === 'nacional' ? 'NFS-e Nacional' : 'WebService'}`;

if (content.includes(singleLayoutTarget)) {
    content = content.replace(singleLayoutTarget, singleLayoutReplacement);
    console.log("Sucesso: Corrigido Layout de integração no card de busca única.");
} else {
    console.warn("Aviso: Target layout de busca única não encontrado.");
}

// 2. Single search card - Certificado Checklist (remove negation)
const singleCertTarget = `{!tecnoSpeedCityInfo.certificado ? (\n                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">\n                                                                <Check size={9} strokeWidth={4} />\n                                                            </span>\n                                                        ) : (\n                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">\n                                                                <X size={9} strokeWidth={4} />\n                                                            </span>\n                                                        )}`;
const singleCertReplacement = `{tecnoSpeedCityInfo.certificado ? (\n                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">\n                                                                <Check size={9} strokeWidth={4} />\n                                                            </span>\n                                                        ) : (\n                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">\n                                                                <X size={9} strokeWidth={4} />\n                                                            </span>\n                                                        )}`;

if (content.includes(singleCertTarget)) {
    content = content.replace(singleCertTarget, singleCertReplacement);
    console.log("Sucesso: Corrigido Certificado no checklist do card de busca única.");
} else {
    console.warn("Aviso: Target certificado de busca única não encontrado. Tentando aproximação simples...");
    // Fallback de aproximação simples
    const certFallback = `{!tecnoSpeedCityInfo.certificado ? (`;
    if (content.includes(certFallback)) {
        content = content.replace(certFallback, `{tecnoSpeedCityInfo.certificado ? (`);
        console.log("Sucesso (Fallback): Corrigido Certificado no checklist de busca única.");
    } else {
        console.error("ERRO: Não encontrou o checklist de certificado de busca única!");
    }
}

// 3. Modal loop card - Layout
const modalLayoutTarget = `{cityInfo?.padraoNacional?.producao || cityInfo?.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}`;
const modalLayoutReplacement = `{cityInfo?.padrao?.toLowerCase() === 'nacional' ? 'NFS-e Nacional' : 'WebService'}`;

if (content.includes(modalLayoutTarget)) {
    content = content.replace(modalLayoutTarget, modalLayoutReplacement);
    console.log("Sucesso: Corrigido Layout de integração no card do modal.");
} else {
    console.warn("Aviso: Target layout do modal não encontrado.");
}

// 4. Modal loop card - Certificado Checklist (remove negation)
const modalCertTarget = `{!cityInfo?.certificado ? (\n                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">\n                                                                            <Check size={9} strokeWidth={4} />\n                                                                        </span>\n                                                                    ) : (\n                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">\n                                                                            <X size={9} strokeWidth={4} />\n                                                                        </span>\n                                                                    )}`;
const modalCertReplacement = `{cityInfo?.certificado ? (\n                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">\n                                                                            <Check size={9} strokeWidth={4} />\n                                                                        </span>\n                                                                    ) : (\n                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">\n                                                                            <X size={9} strokeWidth={4} />\n                                                                        </span>\n                                                                    )}`;

if (content.includes(modalCertTarget)) {
    content = content.replace(modalCertTarget, modalCertReplacement);
    console.log("Sucesso: Corrigido Certificado no checklist do card do modal.");
} else {
    console.warn("Aviso: Target certificado do modal não encontrado. Tentando aproximação simples...");
    // Fallback de aproximação simples
    const certFallback = `{!cityInfo?.certificado ? (`;
    if (content.includes(certFallback)) {
        content = content.replace(certFallback, `{cityInfo?.certificado ? (`);
        console.log("Sucesso (Fallback): Corrigido Certificado no checklist do modal.");
    } else {
        console.error("ERRO: Não encontrou o checklist de certificado do modal!");
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Sucesso: Arquivo FiscalSettings.tsx atualizado!");
