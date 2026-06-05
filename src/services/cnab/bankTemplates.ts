export interface BankTemplate {
    bankCode: string; // 3 chars
    bankName: string; // up to 30 chars
    companyCodeLength?: number;
}

export const BANK_TEMPLATES: Record<string, BankTemplate> = {
    '001': { bankCode: '001', bankName: 'BANCO DO BRASIL S.A.' },
    '341': { bankCode: '341', bankName: 'BANCO ITAU S.A.' },
    '237': { bankCode: '237', bankName: 'BANCO BRADESCO S.A.' },
    '033': { bankCode: '033', bankName: 'BANCO SANTANDER (BRASIL) S.A.' },
    '104': { bankCode: '104', bankName: 'CAIXA ECONOMICA FEDERAL' },
    '077': { bankCode: '077', bankName: 'BANCO INTER S.A.' },
    '748': { bankCode: '748', bankName: 'BANCO COOPERATIVO SICREDI S.A.' },
    '756': { bankCode: '756', bankName: 'BANCO COOPERATIVO DO BRASIL S.A. - SICOOB' }
};
