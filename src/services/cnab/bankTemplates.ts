export interface BankTemplate {
    bankCode: string; // 3 chars
    bankName: string; // up to 30 chars
    companyCodeLength?: number;
}

export const BANK_TEMPLATES: Record<string, BankTemplate> = {
    // Bancos comerciais e múltiplos
    '001': { bankCode: '001', bankName: 'BANCO DO BRASIL S.A.' },
    '033': { bankCode: '033', bankName: 'BANCO SANTANDER (BRASIL) S.A.' },
    '041': { bankCode: '041', bankName: 'BANRISUL S.A.' },
    '070': { bankCode: '070', bankName: 'BRB - BCO DE BRASILIA S.A.' },
    '077': { bankCode: '077', bankName: 'BANCO INTER S.A.' },
    '085': { bankCode: '085', bankName: 'COOPERATIVA CENTRAL AILOS' },
    '104': { bankCode: '104', bankName: 'CAIXA ECONOMICA FEDERAL' },
    '136': { bankCode: '136', bankName: 'UNICRED' },
    '212': { bankCode: '212', bankName: 'BANCO ORIGINAL S.A.' },
    '237': { bankCode: '237', bankName: 'BANCO BRADESCO S.A.' },
    '246': { bankCode: '246', bankName: 'BANCO ABC BRASIL S.A.' },
    '260': { bankCode: '260', bankName: 'NU PAGAMENTOS S.A. (NUBANK)' },
    '290': { bankCode: '290', bankName: 'PAGSEGURO INTERNET S.A.' },
    '323': { bankCode: '323', bankName: 'MERCADO PAGO' },
    '336': { bankCode: '336', bankName: 'BANCO C6 S.A.' },
    '341': { bankCode: '341', bankName: 'BANCO ITAU S.A.' },
    '389': { bankCode: '389', bankName: 'BANCO MERCANTIL DO BRASIL S.A' },
    '422': { bankCode: '422', bankName: 'BANCO SAFRA S.A.' },
    '633': { bankCode: '633', bankName: 'BANCO RENDIMENTO S.A.' },
    '655': { bankCode: '655', bankName: 'BANCO VOTORANTIM S.A.' },
    '745': { bankCode: '745', bankName: 'BANCO CITIBANK S.A.' },
    '748': { bankCode: '748', bankName: 'BANCO COOP SICREDI S.A.' },
    '756': { bankCode: '756', bankName: 'BCO COOP DO BRASIL - SICOOB' },
};
