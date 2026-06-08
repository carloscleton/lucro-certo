import { BANK_TEMPLATES } from './bankTemplates';

// Helper functions for CNAB fixed-length formatting
export const padAlpha = (text: string, length: number): string => {
    // Remove diacritics and convert to uppercase
    const cleanText = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ''); // Keep only letters, numbers and spaces
        
    if (cleanText.length > length) {
        return cleanText.substring(0, length);
    }
    return cleanText.padEnd(length, ' ');
};

export const padNum = (num: number | string, length: number): string => {
    const cleanNum = String(num).replace(/\D/g, '');
    if (cleanNum.length > length) {
        return cleanNum.substring(cleanNum.length - length); // get last X chars
    }
    return cleanNum.padStart(length, '0');
};

export const formatCurrency = (amount: number, length: number): string => {
    // Convert to cents
    const cents = Math.round(amount * 100);
    return padNum(cents, length);
};

export const formatDate = (dateString: string): string => {
    // Expected output: DDMMAAAA
    try {
        const date = new Date(dateString);
        // Ajuste de timezone simples pegando a data do componente
        const isoParts = dateString.split('T')[0].split('-');
        if (isoParts.length === 3) {
            return `${isoParts[2]}${isoParts[1]}${isoParts[0]}`;
        }
        const dd = padNum(date.getUTCDate(), 2);
        const mm = padNum(date.getUTCMonth() + 1, 2);
        const yyyy = date.getUTCFullYear();
        return `${dd}${mm}${yyyy}`;
    } catch {
        return '00000000';
    }
};

export const formatTime = (date?: Date): string => {
    // Expected output: HHMMSS
    const d = date || new Date();
    const hh = padNum(d.getHours(), 2);
    const mm = padNum(d.getMinutes(), 2);
    const ss = padNum(d.getSeconds(), 2);
    return `${hh}${mm}${ss}`;
};

export interface CompanyBankInfo {
    cnpj: string;
    legal_name: string;
    bankCode: string; // e.g. 001
    agency: string;
    agency_dv: string;
    account: string;
    account_dv: string;
    company_code?: string; // Convênio/Código da Empresa no Banco
}

export interface PaymentItem {
    id: string; // Nosso número ou controle interno
    barcode?: string;
    linha_digitavel?: string;
    amount: number;
    due_date: string;
    beneficiary_name?: string;
}

export const modulo10 = (num: string): number => {
    let sum = 0;
    let weight = 2;
    for (let i = num.length - 1; i >= 0; i--) {
        let val = parseInt(num[i]) * weight;
        if (val > 9) {
            val = Math.floor(val / 10) + (val % 10);
        }
        sum += val;
        weight = weight === 2 ? 1 : 2;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
};

export const modulo11Bank = (num: string): number => {
    let sum = 0;
    let weight = 2;
    for (let i = num.length - 1; i >= 0; i--) {
        sum += parseInt(num[i]) * weight;
        weight = weight === 9 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    const dv = 11 - remainder;
    if (dv === 0 || dv === 10 || dv === 11) return 1;
    return dv;
};

export const modulo11Utility = (num: string): number => {
    let sum = 0;
    let weight = 2;
    for (let i = num.length - 1; i >= 0; i--) {
        sum += parseInt(num[i]) * weight;
        weight = weight === 9 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    if (remainder === 0 || remainder === 1) return 0;
    if (remainder === 10) return 1;
    return 11 - remainder;
};

export interface BoletoValidationResult {
    isValid: boolean;
    type: 'bank' | 'utility' | 'invalid';
    clean: string;
    barcode: string;
    errors: string[];
}

export const getBarcodeFromLinhaDigitavel = (linha: string): string => {
    const clean = linha.replace(/\D/g, '');
    if (clean.length === 44) return clean; // Já é um código de barras
    if (clean.length === 47) {
        // Converte Linha Digitável (47) para Código de Barras (44)
        const banco = clean.substring(0, 3);
        const moeda = clean.substring(3, 4);
        const livre1 = clean.substring(4, 9);
        const livre2 = clean.substring(10, 20);
        const livre3 = clean.substring(21, 31);
        const dvGeral = clean.substring(32, 33);
        const fatorVencimento = clean.substring(33, 37);
        const valor = clean.substring(37, 47);
        return `${banco}${moeda}${dvGeral}${fatorVencimento}${valor}${livre1}${livre2}${livre3}`;
    }
    if (clean.length === 48) {
        // Concessionária: 4 blocos de 12 (11 dados + 1 DV)
        return clean.substring(0, 11) + clean.substring(12, 23) + clean.substring(24, 35) + clean.substring(36, 47);
    }
    return clean.padEnd(44, '0').substring(0, 44); // Fallback de segurança
};

export const validateBoleto = (linha: string): BoletoValidationResult => {
    const errors: string[] = [];
    const clean = linha.replace(/\D/g, '');
    
    if (!clean) {
        return { isValid: false, type: 'invalid', clean: '', barcode: '', errors: ['Código vazio'] };
    }
    
    if (clean.length !== 44 && clean.length !== 47 && clean.length !== 48) {
        return { 
            isValid: false, 
            type: 'invalid', 
            clean, 
            barcode: '', 
            errors: [`Tamanho inválido (${clean.length} dígitos). Deve ter 44, 47 ou 48 dígitos`] 
        };
    }
    
    const isUtility = clean.startsWith('8');
    const type = isUtility ? 'utility' : 'bank';

    if (type === 'utility' && clean.length !== 44 && clean.length !== 48) {
        return {
            isValid: false,
            type: 'invalid',
            clean,
            barcode: '',
            errors: [`Código de concessionária/tributo deve ter 44 ou 48 dígitos (possui ${clean.length})`]
        };
    }

    if (type === 'bank' && clean.length !== 44 && clean.length !== 47) {
        return {
            isValid: false,
            type: 'invalid',
            clean,
            barcode: '',
            errors: [`Boleto bancário deve ter 44 ou 47 dígitos (possui ${clean.length})`]
        };
    }

    const barcode = getBarcodeFromLinhaDigitavel(clean);
    
    if (isUtility) {
        if (clean.length === 48) {
            // Validar os DVs dos 4 blocos
            const b1 = clean.substring(0, 12);
            const b2 = clean.substring(12, 24);
            const b3 = clean.substring(24, 36);
            const b4 = clean.substring(36, 48);
            
            const refVal = clean[2];
            const useMod11 = refVal === '7' || refVal === '9';
            
            const calcDv = (num: string) => {
                return useMod11 ? modulo11Utility(num) : modulo10(num);
            };
            
            if (calcDv(b1.substring(0, 11)) !== parseInt(b1[11])) {
                errors.push('Dígito verificador do Bloco 1 inválido');
            }
            if (calcDv(b2.substring(0, 11)) !== parseInt(b2[11])) {
                errors.push('Dígito verificador do Bloco 2 inválido');
            }
            if (calcDv(b3.substring(0, 11)) !== parseInt(b3[11])) {
                errors.push('Dígito verificador do Bloco 3 inválido');
            }
            if (calcDv(b4.substring(0, 11)) !== parseInt(b4[11])) {
                errors.push('Dígito verificador do Bloco 4 inválido');
            }
        }
    } else {
        if (clean.length === 47) {
            // Validar DVs dos 3 campos
            const f1 = clean.substring(0, 9);
            const dv1 = parseInt(clean[9]);
            const f2 = clean.substring(10, 20);
            const dv2 = parseInt(clean[20]);
            const f3 = clean.substring(21, 31);
            const dv3 = parseInt(clean[31]);
            
            if (modulo10(f1) !== dv1) errors.push('Dígito verificador do Campo 1 inválido');
            if (modulo10(f2) !== dv2) errors.push('Dígito verificador do Campo 2 inválido');
            if (modulo10(f3) !== dv3) errors.push('Dígito verificador do Campo 3 inválido');
        }
        
        // Validar DV Geral do código de barras
        if (barcode.length === 44) {
            const barcodeWithoutDv = barcode.substring(0, 4) + barcode.substring(5);
            const dvGeral = parseInt(barcode[4]);
            if (modulo11Bank(barcodeWithoutDv) !== dvGeral) {
                errors.push('Dígito verificador geral do código de barras inválido');
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        type,
        clean,
        barcode,
        errors
    };
};

export const generateCnab240 = (
    company: CompanyBankInfo,
    payments: PaymentItem[],
    sequentialNSA: number = 1
): string => {
    const bank = BANK_TEMPLATES[company.bankCode] || { bankCode: company.bankCode, bankName: 'BANCO' };
    const dateToday = formatDate(new Date().toISOString());
    const timeNow = formatTime();
    let lines: string[] = [];
    
    // Separar os pagamentos por tipo
    const bankPayments = payments.filter(p => {
        const rawBarcode = p.barcode || p.linha_digitavel || '';
        const validation = validateBoleto(rawBarcode);
        return validation.type === 'bank';
    });
    
    const utilityPayments = payments.filter(p => {
        const rawBarcode = p.barcode || p.linha_digitavel || '';
        const validation = validateBoleto(rawBarcode);
        return validation.type === 'utility';
    });
    
    // --- HEADER DE ARQUIVO (Registro 0) ---
    const isCnpjCompany = company.cnpj.replace(/\D/g, '').length > 11;
    const tipoInscricao = isCnpjCompany ? '2' : '1'; // 1=CPF (Pessoa Física), 2=CNPJ (Pessoa Jurídica)
    let header = '';
    header += padNum(company.bankCode, 3); // 01.0 Banco
    header += '0000'; // 02.0 Lote (0000)
    header += '0'; // 03.0 Tipo Registro (0)
    header += ''.padEnd(9, ' '); // 04.0 Brancos
    header += tipoInscricao; // 05.0 Tipo Inscrição (1=CPF / 2=CNPJ)
    header += padNum(company.cnpj, 14); // 06.0 Inscrição
    header += padAlpha(company.company_code || '', 20); // 07.0 Código do Convênio no Banco
    header += padNum(company.agency, 5); // 08.0 Agência
    header += padAlpha(company.agency_dv, 1); // 09.0 DV Agência
    header += padNum(company.account, 12); // 10.0 Conta
    header += padAlpha(company.account_dv, 1); // 11.0 DV Conta
    header += padAlpha('', 1); // 12.0 DV Ag/Conta
    header += padAlpha(company.legal_name, 30); // 13.0 Nome da Empresa
    header += padAlpha(bank.bankName, 30); // 14.0 Nome do Banco
    header += ''.padEnd(10, ' '); // 15.0 Brancos
    header += '1'; // 16.0 Código Remessa/Retorno (1=Remessa)
    header += dateToday; // 17.0 Data de Geração
    header += timeNow; // 18.0 Hora de Geração
    header += padNum(sequentialNSA, 6); // 19.0 NSA
    header += '081'; // 20.0 Versão Layout Febraban
    header += padNum(0, 5); // 21.0 Densidade Arquivo
    header += ''.padEnd(20, ' '); // 22.0 Reservado Banco
    header += ''.padEnd(20, ' '); // 23.0 Reservado Empresa
    header += ''.padEnd(29, ' '); // 24.0 Brancos
    lines.push(header);

    let lotNumber = 1;

    // --- LOTE DE BOLETOS BANCÁRIOS (Segmento J) ---
    if (bankPayments.length > 0) {
        const currentLot = lotNumber++;
        let lotHeader = '';
        lotHeader += padNum(company.bankCode, 3); // 01.1 Banco
        lotHeader += padNum(currentLot, 4); // 02.1 Lote
        lotHeader += '1'; // 03.1 Tipo Registro (1)
        lotHeader += 'C'; // 04.1 Operação (C=Crédito/Pagamento)
        lotHeader += '20'; // 05.1 Tipo de Serviço (20=Pagamento Fornecedor/Boletos)
        lotHeader += '31'; // 06.1 Forma Lançamento (31 = Pagamento Títulos Outros Bancos)
        lotHeader += '040'; // 07.1 Versão Layout do Lote
        lotHeader += ' '; // 08.1 Brancos
        lotHeader += tipoInscricao; // 09.1 Tipo Inscrição (1=CPF / 2=CNPJ)
        lotHeader += padNum(company.cnpj, 14); // 10.1 Inscrição
        lotHeader += padAlpha(company.company_code || '', 20); // 11.1 Convênio
        lotHeader += padNum(company.agency, 5); // 12.1 Agência
        lotHeader += padAlpha(company.agency_dv, 1); // 13.1 DV Agência
        lotHeader += padNum(company.account, 12); // 14.1 Conta
        lotHeader += padAlpha(company.account_dv, 1); // 15.1 DV Conta
        lotHeader += padAlpha('', 1); // 16.1 DV Ag/Conta
        lotHeader += padAlpha(company.legal_name, 30); // 17.1 Nome da Empresa
        lotHeader += ''.padEnd(40, ' '); // 18.1 Mensagem
        lotHeader += padAlpha(company.legal_name, 30); // 19.1 Endereço Empresa
        lotHeader = lotHeader.substring(0, 153) + ''.padEnd(87, ' ');
        lines.push(lotHeader);

        let lotAmount = 0;
        let sequenceInLot = 1;

        bankPayments.forEach((payment) => {
            // Segmento J
            let det = '';
            det += padNum(company.bankCode, 3); // 01.3 Banco
            det += padNum(currentLot, 4); // 02.3 Lote
            det += '3'; // 03.3 Tipo Registro (3=Detalhe)
            det += padNum(sequenceInLot++, 5); // 04.3 Sequencial
            det += 'J'; // 05.3 Cód Segmento
            det += '0'; // 06.3 Tipo Movimento (0=Inclusão)
            det += '00'; // 07.3 Cód Inst Movimento
            
            const rawBarcode = payment.barcode || payment.linha_digitavel || '';
            const safeBarcode = getBarcodeFromLinhaDigitavel(rawBarcode);
            const bc = safeBarcode.padEnd(44, '0').substring(0, 44);
            
            det += bc.substring(0, 3);  // 08.3 Banco Cedente (3)
            det += bc.substring(3, 4);  // 09.3 Moeda (1)
            det += bc.substring(4, 5);  // 10.3 DV do Código de Barras (1)
            det += bc.substring(5, 9);  // 11.3 Fator de Vencimento (4)
            det += bc.substring(9, 19); // 12.3 Valor Nominal (10)
            det += bc.substring(19, 44);// 13.3 Campo Livre (25)

            det += padAlpha(payment.beneficiary_name || 'FORNECEDOR', 30); // 14.3 Nome do Cedente
            det += formatDate(payment.due_date);       // 15.3 Data Vencimento
            det += formatCurrency(payment.amount, 15); // 16.3 Valor do Título
            det += formatCurrency(0, 15);              // 17.3 Desconto/Abatimento
            det += formatCurrency(0, 15);              // 18.3 Acréscimos/Mora
            det += dateToday;                          // 19.3 Data do Pagamento
            det += formatCurrency(payment.amount, 15); // 20.3 Valor do Pagamento
            det += formatCurrency(0, 15);              // 21.3 Quantidade de Moeda
            det += padAlpha(payment.id.substring(0, 20), 20); // 22.3 Seu Número
            det += ''.padEnd(20, ' ');  // 23.3 Nosso Número no Banco
            det += '09';                // 24.3 Código Moeda (09 = Real)
            det += ''.padEnd(6, ' ');   // 25.3 Brancos
            det += ''.padEnd(10, ' ');  // 26.3 Ocorrências
            lines.push(det);

            // Segmento J-52
            let det52 = '';
            det52 += padNum(company.bankCode, 3); // 01.3 Banco
            det52 += padNum(currentLot, 4); // 02.3 Lote
            det52 += '3'; // 03.3 Tipo Registro (3=Detalhe)
            det52 += padNum(sequenceInLot++, 5); // 04.3 Sequencial
            det52 += 'J'; // 05.3 Cód Segmento
            det52 += ' '; // 06.3 Brancos
            det52 += '00'; // 07.3 Cód Inst Movimento
            det52 += '52'; // 08.3 Identificação Registro Opcional (52)
            
            const isCnpj = company.cnpj.replace(/\D/g, '').length > 11;
            det52 += isCnpj ? '2' : '1'; // 09.3 Tipo Inscrição Sacado
            det52 += padNum(company.cnpj, 15); // 10.3 Inscrição Sacado
            det52 += padAlpha(company.legal_name, 40); // 11.3 Nome do Sacado
            
            det52 += '0'; // 12.3 Tipo Inscrição Beneficiário
            det52 += padNum(0, 15); // 13.3 Inscrição Beneficiário
            det52 += padAlpha(payment.beneficiary_name || 'FORNECEDOR', 40); // 14.3 Nome do Beneficiário
            
            det52 += '0'; // 15.3 Tipo Inscrição Sacador/Avalista
            det52 += padNum(0, 15); // 16.3 Inscrição Sacador/Avalista
            det52 += padAlpha('', 40); // 17.3 Nome Sacador/Avalista
            det52 += ''.padEnd(53, ' '); // 18.3 Brancos
            lines.push(det52);
            
            lotAmount += payment.amount;
        });

        // Trailer do Lote (Registro 5)
        const qtdRegistrosLote = 1 + (sequenceInLot - 1) + 1;
        let lotTrailer = '';
        lotTrailer += padNum(company.bankCode, 3); // 01.5 Banco
        lotTrailer += padNum(currentLot, 4); // 02.5 Lote
        lotTrailer += '5'; // 03.5 Tipo Registro
        lotTrailer += ''.padEnd(9, ' '); // 04.5 Brancos
        lotTrailer += padNum(qtdRegistrosLote, 6); // 05.5 Qtd Registros Lote
        lotTrailer += formatCurrency(lotAmount, 18); // 06.5 Somatória Valores
        lotTrailer += padNum(0, 18); // 07.5 Somatória Qtd Moeda
        lotTrailer += ''.padEnd(181, ' '); // 08.5 Brancos
        lines.push(lotTrailer);
    }

    // --- LOTE DE CONCESSIONÁRIAS / TRIBUTOS (Segmento O) ---
    if (utilityPayments.length > 0) {
        const currentLot = lotNumber++;
        let lotHeader = '';
        lotHeader += padNum(company.bankCode, 3); // 01.1 Banco
        lotHeader += padNum(currentLot, 4); // 02.1 Lote
        lotHeader += '1'; // 03.1 Tipo Registro (1)
        lotHeader += 'C'; // 04.1 Operação (C=Crédito/Pagamento)
        lotHeader += '22'; // 05.1 Tipo de Serviço (22=Pagamento Contas e Tributos/Concessionárias)
        lotHeader += '13'; // 06.1 Forma Lançamento (13=Pagamento de Concessionárias / Tributos com Cód Barras)
        lotHeader += '040'; // 07.1 Versão Layout
        lotHeader += ' '; // 08.1 Brancos
        lotHeader += tipoInscricao; // 09.1 Tipo Inscrição (1=CPF / 2=CNPJ)
        lotHeader += padNum(company.cnpj, 14); // 10.1 Inscrição
        lotHeader += padAlpha(company.company_code || '', 20); // 11.1 Convênio
        lotHeader += padNum(company.agency, 5); // 12.1 Agência
        lotHeader += padAlpha(company.agency_dv, 1); // 13.1 DV Agência
        lotHeader += padNum(company.account, 12); // 14.1 Conta
        lotHeader += padAlpha(company.account_dv, 1); // 15.1 DV Conta
        lotHeader += padAlpha('', 1); // 16.1 DV Ag/Conta
        lotHeader += padAlpha(company.legal_name, 30); // 17.1 Nome da Empresa
        lotHeader += ''.padEnd(40, ' '); // 18.1 Mensagem
        lotHeader += padAlpha(company.legal_name, 30); // 19.1 Endereço Empresa
        lotHeader = lotHeader.substring(0, 153) + ''.padEnd(87, ' ');
        lines.push(lotHeader);

        let lotAmount = 0;
        let sequenceInLot = 1;

        utilityPayments.forEach((payment) => {
            // Segmento O
            let det = '';
            det += padNum(company.bankCode, 3); // 01.3 Banco
            det += padNum(currentLot, 4); // 02.3 Lote
            det += '3'; // 03.3 Tipo Registro (3=Detalhe)
            det += padNum(sequenceInLot++, 5); // 04.3 Sequencial
            det += 'O'; // 05.3 Cód Segmento (O = Concessionárias/Tributos)
            det += ' '; // 06.3 Brancos
            det += '00'; // 07.3 Cód Inst Movimento
            
            const rawBarcode = payment.barcode || payment.linha_digitavel || '';
            const safeBarcode = getBarcodeFromLinhaDigitavel(rawBarcode);
            const bc = safeBarcode.padEnd(44, '0').substring(0, 44);
            det += bc; // 08.3 Código de Barras (44 posições)
            
            det += padAlpha(payment.beneficiary_name || 'CONCESSIONARIA', 30); // 09.3 Nome
            det += formatDate(payment.due_date);       // 10.3 Data Vencimento
            det += dateToday;                          // 11.3 Data Pagamento
            det += formatCurrency(payment.amount, 15); // 12.3 Valor
            det += padAlpha(payment.id.substring(0, 20), 20); // 13.3 Seu Número
            det += ''.padEnd(20, ' ');  // 14.3 Nosso Número
            det += ''.padEnd(68, ' ');  // 15.3 Brancos
            det += ''.padEnd(10, ' ');  // 16.3 Ocorrências
            lines.push(det);

            lotAmount += payment.amount;
        });

        // Trailer do Lote (Registro 5)
        const qtdRegistrosLote = 1 + (sequenceInLot - 1) + 1;
        let lotTrailer = '';
        lotTrailer += padNum(company.bankCode, 3); // 01.5 Banco
        lotTrailer += padNum(currentLot, 4); // 02.5 Lote
        lotTrailer += '5'; // 03.5 Tipo Registro
        lotTrailer += ''.padEnd(9, ' '); // 04.5 Brancos
        lotTrailer += padNum(qtdRegistrosLote, 6); // 05.5 Qtd Registros Lote
        lotTrailer += formatCurrency(lotAmount, 18); // 06.5 Somatória Valores
        lotTrailer += padNum(0, 18); // 07.5 Somatória Qtd Moeda
        lotTrailer += ''.padEnd(181, ' '); // 08.5 Brancos
        lines.push(lotTrailer);
    }

    // --- TRAILER DO ARQUIVO (Registro 9) ---
    let trailer = '';
    trailer += padNum(company.bankCode, 3); // 01.9 Banco
    trailer += '9999'; // 02.9 Lote (9999)
    trailer += '9'; // 03.9 Tipo Registro (9)
    trailer += ''.padEnd(9, ' '); // 04.9 Brancos
    trailer += padNum(lotNumber - 1, 6); // 05.9 Qtd de Lotes no Arquivo
    trailer += padNum(lines.length + 1, 6); // 06.9 Qtd de Registros no Arquivo
    trailer += padNum(0, 6); // 07.9 Qtd de Contas para Conciliação
    trailer += ''.padEnd(205, ' '); // 08.9 Brancos
    lines.push(trailer);

    // --- VALIDAÇÃO: Garantir que todas as linhas tenham exatamente 240 posições ---
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length < 240) {
            lines[i] = lines[i].padEnd(240, ' ');
        } else if (lines[i].length > 240) {
            lines[i] = lines[i].substring(0, 240);
        }
    }

    return lines.join('\r\n'); // CNAB requer CRLF
};
