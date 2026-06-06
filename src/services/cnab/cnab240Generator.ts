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

export const generateCnab240 = (
    company: CompanyBankInfo,
    payments: PaymentItem[],
    sequentialNSA: number = 1
): string => {
    const bank = BANK_TEMPLATES[company.bankCode] || { bankCode: company.bankCode, bankName: 'BANCO' };
    const dateToday = formatDate(new Date().toISOString());
    const timeNow = formatTime();
    let lines: string[] = [];
    
    // --- HEADER DE ARQUIVO (Registro 0) ---
    let header = '';
    header += padNum(company.bankCode, 3); // 01.0 Banco
    header += '0000'; // 02.0 Lote (0000)
    header += '0'; // 03.0 Tipo Registro (0)
    header += ''.padEnd(9, ' '); // 04.0 Brancos
    header += '2'; // 05.0 Tipo Inscrição (2 = CNPJ)
    header += padNum(company.cnpj, 14); // 06.0 Inscrição
    // Código do convênio (varia muito por banco, padrão Febraban é 20, preencheremos com zeros e espaços)
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
    header += padNum(sequentialNSA, 6); // 19.0 NSA (Número Sequencial do Arquivo)
    header += '081'; // 20.0 Versão Layout Febraban
    header += padNum(0, 5); // 21.0 Densidade Arquivo
    header += ''.padEnd(20, ' '); // 22.0 Para Uso Reservado do Banco
    header += ''.padEnd(20, ' '); // 23.0 Para Uso Reservado da Empresa
    header += ''.padEnd(29, ' '); // 24.0 Brancos
    lines.push(header);

    // --- HEADER DE LOTE (Registro 1) ---
    // Vamos criar um lote único para pagamentos de boletos (Segmento J)
    const lotNumber = 1;
    let lotHeader = '';
    lotHeader += padNum(company.bankCode, 3); // 01.1 Banco
    lotHeader += padNum(lotNumber, 4); // 02.1 Lote (1)
    lotHeader += '1'; // 03.1 Tipo Registro (1)
    lotHeader += 'C'; // 04.1 Operação (C=Crédito/Pagamento, D=Débito)
    lotHeader += '20'; // 05.1 Tipo de Serviço (20=Pagamento Fornecedor/Boletos)
    lotHeader += '30'; // 06.1 Forma Lançamento (30 = Liq Titulos de Cobrança)
    lotHeader += '041'; // 07.1 Versão Layout do Lote
    lotHeader += ' '; // 08.1 Brancos
    lotHeader += '2'; // 09.1 Tipo Inscrição (2=CNPJ)
    lotHeader += padNum(company.cnpj, 14); // 10.1 Inscrição
    lotHeader += padAlpha(company.company_code || '', 20); // 11.1 Convênio
    lotHeader += padNum(company.agency, 5); // 12.1 Agência
    lotHeader += padAlpha(company.agency_dv, 1); // 13.1 DV Agência
    lotHeader += padNum(company.account, 12); // 14.1 Conta
    lotHeader += padAlpha(company.account_dv, 1); // 15.1 DV Conta
    lotHeader += padAlpha('', 1); // 16.1 DV Ag/Conta
    lotHeader += padAlpha(company.legal_name, 30); // 17.1 Nome da Empresa
    lotHeader += ''.padEnd(40, ' '); // 18.1 Mensagem
    lotHeader += padAlpha(company.legal_name, 30); // 19.1 Endereço Empresa (simplificado, colando o nome pq muitos bancos ignoram se endereco n for necessario)
    // O padrão manda colocar Rua, etc. Mas por segurança vamos mandar vazio no lote de pagamentos se não for exigido.
    lotHeader = lotHeader.substring(0, 153) + ''.padEnd(87, ' '); // Zerando o resto para evitar quebra de colunas (153 + 87 = 240)
    lines.push(lotHeader);

    // --- DETALHES (Registro 3 - Segmento J) ---
    let totalAmount = 0;
    let sequenceInLot = 1;

    payments.forEach((payment) => {
        let det = '';
        det += padNum(company.bankCode, 3); // 01.3 Banco
        det += padNum(lotNumber, 4); // 02.3 Lote
        det += '3'; // 03.3 Tipo Registro (3=Detalhe)
        det += padNum(sequenceInLot++, 5); // 04.3 Sequencial do Registro no Lote
        det += 'J'; // 05.3 Cód Segmento (J = Pagamento de Títulos)
        det += '0'; // 06.3 Tipo Movimento (0=Inclusão)
        det += '00'; // 07.3 Cód Inst Movimento (00 = Inclusão de Pagamento)
        
        // Código de Barras (44 Posições) - Tratando conversão de Linha Digitável
        const rawBarcode = payment.barcode || payment.linha_digitavel || '';
        const safeBarcode = getBarcodeFromLinhaDigitavel(rawBarcode);
        
        det += safeBarcode.substring(0, 3); // 08.3 Banco Beneficiário
        det += safeBarcode.substring(3, 4); // 09.3 Moeda
        det += safeBarcode.substring(4, 5); // 10.3 DV do Código de Barras
        det += safeBarcode.substring(5, 9); // 11.3 Fator Vencimento
        det += safeBarcode.substring(9, 19); // 12.3 Valor do Título no Código de Barras
        det += safeBarcode.substring(19, 44); // 13.3 Campo Livre do Código de Barras

        det += padAlpha(payment.beneficiary_name || 'FORNECEDOR', 30); // 14.3 Nome do Cedente
        det += formatDate(payment.due_date); // 15.3 Data Vencimento
        det += formatCurrency(payment.amount, 15); // 16.3 Valor do Título (pos 100-114)
        det += formatCurrency(0, 15); // 17.3 Desconto/Abatimento (pos 115-129)
        det += formatCurrency(0, 15); // 18.3 Acréscimos/Mora (pos 130-144)
        det += dateToday; // 19.3 Data do Pagamento (pos 145-152)
        det += formatCurrency(payment.amount, 15); // 20.3 Valor do Pagamento (pos 153-167)
        det += formatCurrency(0, 15); // 21.3 Quantidade de Moeda (pos 168-182)
        det += padAlpha(payment.id.substring(0, 20), 20); // 22.3 Seu Número (pos 183-202)
        det += ''.padEnd(20, ' '); // 23.3 Nosso Número no Banco (pos 203-222)
        det += '09'; // 24.3 Código Moeda (09 = Real) (pos 223-224)
        det += ''.padEnd(6, ' '); // 25.3 Brancos (pos 225-230)
        det += ''.padEnd(10, ' '); // 26.3 Ocorrências (pos 231-240)
        
        lines.push(det);

        // --- DETALHES (Registro 3 - Segmento J-52) ---
        // Obrigatório no Inter e outros bancos para detalhar Pagador/Recebedor
        let det52 = '';
        det52 += padNum(company.bankCode, 3); // 01.3 Banco
        det52 += padNum(lotNumber, 4); // 02.3 Lote
        det52 += '3'; // 03.3 Tipo Registro (3=Detalhe)
        det52 += padNum(sequenceInLot++, 5); // 04.3 Sequencial (aumenta o sequencial)
        det52 += 'J'; // 05.3 Cód Segmento
        det52 += ' '; // 06.3 Brancos
        det52 += '00'; // 07.3 Cód Inst Movimento (00 = Inclusão)
        det52 += '52'; // 08.3 Identificação Registro Opcional (52)
        
        // Pagador (Nossa Empresa)
        const isCnpj = company.cnpj.replace(/\D/g, '').length > 11;
        det52 += isCnpj ? '2' : '1'; // 09.3 Tipo Inscrição Sacado
        det52 += padNum(company.cnpj, 15); // 10.3 Inscrição Sacado
        det52 += padAlpha(company.legal_name, 40); // 11.3 Nome do Sacado
        
        // Beneficiário (Fornecedor)
        // Não temos o CNPJ/CPF exato na interface atual, então enviamos 0 (Isento/Não informado)
        det52 += '0'; // 12.3 Tipo Inscrição Beneficiário
        det52 += padNum(0, 15); // 13.3 Inscrição Beneficiário
        det52 += padAlpha(payment.beneficiary_name || 'FORNECEDOR', 40); // 14.3 Nome do Beneficiário
        
        // Sacador / Avalista
        det52 += '0'; // 15.3 Tipo Inscrição Sacador/Avalista
        det52 += padNum(0, 15); // 16.3 Inscrição Sacador/Avalista
        det52 += padAlpha('', 40); // 17.3 Nome Sacador/Avalista
        
        det52 += ''.padEnd(53, ' '); // 18.3 Brancos para completar 240
        
        lines.push(det52);
        
        totalAmount += payment.amount;
    });

    // --- TRAILER DO LOTE (Registro 5) ---
    let lotTrailer = '';
    lotTrailer += padNum(company.bankCode, 3); // 01.5 Banco
    lotTrailer += padNum(lotNumber, 4); // 02.5 Lote
    lotTrailer += '5'; // 03.5 Tipo Registro (5)
    lotTrailer += ''.padEnd(9, ' '); // 04.5 Brancos
    // Quantidade de Registros no Lote (Header + Detalhes + Trailer)
    lotTrailer += padNum(sequenceInLot + 1, 6); // 05.5 Qtd Registros Lote
    lotTrailer += formatCurrency(totalAmount, 18); // 06.5 Valor Total Lote
    lotTrailer += padNum(0, 18); // 07.5 Qtd Moeda Total
    lotTrailer += ''.padEnd(181, ' '); // 08.5 Brancos (completando 240 caracteres)
    lines.push(lotTrailer);

    // --- TRAILER DO ARQUIVO (Registro 9) ---
    let trailer = '';
    trailer += padNum(company.bankCode, 3); // 01.9 Banco
    trailer += '9999'; // 02.9 Lote (9999)
    trailer += '9'; // 03.9 Tipo Registro (9)
    trailer += ''.padEnd(9, ' '); // 04.9 Brancos
    trailer += padNum(1, 6); // 05.9 Qtd de Lotes no Arquivo
    trailer += padNum(lines.length + 1, 6); // 06.9 Qtd de Registros no Arquivo (inclui header e este trailer)
    trailer += ''.padEnd(211, ' '); // 08.9 Brancos
    lines.push(trailer);

    return lines.join('\r\n'); // CNAB requer CRLF
};
