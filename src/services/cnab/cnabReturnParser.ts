export interface ParsedReturnItem {
    idPrefix: string; // The 15 or 20 characters prefix from "Seu Número"
    nossoNumero: string;
    amount: number;
    originalAmount?: number;
    date: string; // YYYY-MM-DD
    status: 'paid' | 'received' | 'rejected' | 'pending';
    occurrenceCode: string;
    occurrenceDescription: string;
    segmentType: 'J' | 'T/U' | 'O';
    interest?: number;
    penalty?: number;
    discount?: number;
}

// Helpers to format dates and numbers from CNAB format
const parseCnabDate = (dateStr: string): string => {
    // Expects DDMMAAAA or DDMMAY
    if (!dateStr || dateStr.trim() === '' || dateStr === '00000000') {
        return new Date().toISOString().split('T')[0];
    }
    const clean = dateStr.replace(/\D/g, '');
    if (clean.length === 8) {
        const dd = clean.substring(0, 2);
        const mm = clean.substring(2, 4);
        const yyyy = clean.substring(4, 8);
        return `${yyyy}-${mm}-${dd}`;
    }
    return new Date().toISOString().split('T')[0];
};

const parseCnabCurrency = (valStr: string): number => {
    const clean = valStr.replace(/\D/g, '');
    const cents = parseInt(clean || '0', 10);
    return cents / 100;
};

// Map Segment J occurrences (positions 231-240, read in pairs)
const getSegmentJOccurrenceDesc = (code: string): { desc: string; isSuccess: boolean; isRejected: boolean } => {
    const map: Record<string, string> = {
        '00': 'Débito/Pagamento Efetivado',
        '03': 'Débito Autorizado pelo Banco',
        '05': 'Pagamento Efetuado',
        'BD': 'Confirmação de Pagamento',
        '12': 'Pagamento Efetivado/Confirmado',
        'A4': 'Pagamento Agendado',
        'A5': 'Pagamento em Data Futura',
        'A6': 'Pagamento Agendado com Sucesso',
        'AE': 'Data Pagamento Alterada',
        'AG': 'Número do Lote Inválido',
        'AH': 'Número Sequencial Inválido',
        'AI': 'Produto Inexistente',
        'AJ': 'Tipo de Movimento Inválido',
        'DA': 'Data de Vencimento Inválida',
        'DB': 'Data de Vencimento Anterior à Emissão',
        'HA': 'Lote não Aceito',
        'HB': 'Inscrição da Empresa Inválida',
        'HC': 'Convênio com Banco Inválido',
        'HD': 'Agência/Conta Inválida',
        'HE': 'Data de Pagamento Inválida',
        'HF': 'Data de Pagamento Antecipada',
        'HG': 'Data de Pagamento Posterior',
        'HH': 'Data de Pagamento Inválida para OC',
        'HI': 'Código de Barras Divergente',
        'HJ': 'Nosso Número Inválido',
        'HK': 'Seu Número Inválido',
        'HL': 'Valor Nominal Inválido',
        'HM': 'Erro nos Dados do Favorecido',
        'HN': 'Código de Barras Inválido',
        'HO': 'Valor do Desconto Inválido',
        'HP': 'Favorecido Divergente',
        'HQ': 'Valor da Mora Inválido',
        'HR': 'Valor da Multa Inválido',
        'HU': 'Valor do INSS Inválido',
        'HV': 'Valor do COFINS Inválido',
        'HW': 'Valor do CSLL Inválido',
        'HX': 'Valor do IR Inválido',
        'HY': 'Valor do ISS Inválido',
        'IA': 'Pagamento Bloqueado',
        'IB': 'Valor do Documento Inválido',
        'IC': 'Insuficiência de Saldo/Limite',
        'ID': 'Conta Encerrada',
        'IE': 'Conta Bloqueada',
        'IF': 'Débito não Autorizado',
        'NA': 'Banco Cedente sem Convênio',
        'NB': 'Tipo de Moeda Inválido',
        'YA': 'Insuficiência de Saldo',
        'YB': 'Número do Documento Exigido',
        'YC': 'Cedente/Favorecido não Cadastrado',
    };

    const desc = map[code.toUpperCase()] || `Ocorrência ${code}`;
    const successCodes = ['00', '03', '05', 'BD', '12'];
    const pendingCodes = ['A4', 'A5', 'A6', 'AE'];
    
    return {
        desc,
        isSuccess: successCodes.includes(code.toUpperCase()),
        isRejected: !successCodes.includes(code.toUpperCase()) && !pendingCodes.includes(code.toUpperCase()) && code.trim() !== ''
    };
};

// Map Segment T movement codes (positions 16-17)
const getSegmentTMovementDesc = (code: string): { desc: string; isSuccess: boolean; isRejected: boolean } => {
    const map: Record<string, string> = {
        '02': 'Entrada Confirmada',
        '03': 'Entrada Rejeitada',
        '04': 'Transferência de Carteira/Entrada',
        '05': 'Transferência de Carteira/Baixa',
        '06': 'Liquidação (Título Pago)',
        '07': 'Confirmação de Recebimento de Instrução',
        '09': 'Baixa de Título Efetivada',
        '10': 'Baixa Rejeitada',
        '14': 'Alteração de Vencimento Confirmada',
        '17': 'Liquidação após baixa',
        '20': 'Em Ser',
        '23': 'Encaminhado a Protesto',
        '24': 'Instrução Rejeitada',
        '25': 'Confirmação de Baixa de Protesto',
        '26': 'Confirmação de Alteração de Multa',
        '27': 'Liquidação em Condicional',
        '28': 'Liquidação por Saldo',
        '30': 'Alteração de Dados Rejeitada',
    };

    const desc = map[code] || `Movimento ${code}`;
    const isSuccess = ['06', '17', '27', '28'].includes(code);
    const isRejected = ['03', '10', '24', '30'].includes(code);

    return {
        desc,
        isSuccess,
        isRejected
    };
};

export function parseCnab240Return(fileContent: string): ParsedReturnItem[] {
    const lines = fileContent.split(/\r?\n/);
    const results: ParsedReturnItem[] = [];

    // Keep track of Segment T to combine with subsequent Segment U
    let lastSegmentT: {
        idPrefix: string;
        nossoNumero: string;
        originalAmount: number;
        movementCode: string;
        lote: string;
        seq: string;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip short lines (valid Febraban lines are exactly 240 chars, we check > 200 for safety)
        if (line.length < 200) continue;

        const recordType = line.substring(7, 8); // pos 8
        const segmentType = line.substring(13, 14); // pos 14
        const lote = line.substring(3, 7); // pos 4-7
        const seq = line.substring(8, 13); // pos 9-13

        // We only care about Detail records (type '3')
        if (recordType !== '3') continue;

        // ──────── Segmento J (Pagamentos / Contas a Pagar) ────────
        if (segmentType === 'J') {
            // "Seu Número" is pos 183-202 (index 182 to 202)
            const idPrefix = line.substring(182, 202).trim();
            // "Nosso Número" is pos 203-222 (index 202 to 222)
            const nossoNumero = line.substring(202, 222).trim();
            
            // If Seu Número is blank, we can't map it back to any transaction
            if (!idPrefix) continue;

            const originalAmount = parseCnabCurrency(line.substring(99, 114)); // pos 100-114
            const amount = parseCnabCurrency(line.substring(152, 167)); // pos 153-167 (Valor Efetivo)
            const date = parseCnabDate(line.substring(144, 152)); // pos 145-152 (Data Efetiva)
            
            // Occurrence is pos 231-240 (read first 2 characters)
            const occurrenceCode = line.substring(230, 232).trim() || '00';
            const { desc, isSuccess, isRejected } = getSegmentJOccurrenceDesc(occurrenceCode);

            let status: ParsedReturnItem['status'] = 'pending';
            if (isSuccess) status = 'paid';
            else if (isRejected) status = 'rejected';

            results.push({
                idPrefix,
                nossoNumero,
                amount: amount > 0 ? amount : originalAmount,
                originalAmount,
                date,
                status,
                occurrenceCode,
                occurrenceDescription: desc,
                segmentType: 'J'
            });
        }

        // ──────── Segmento O (Pagamento de Contas e Tributos) ────────
        else if (segmentType === 'O') {
            const idPrefix = line.substring(122, 142).trim();
            const nossoNumero = line.substring(142, 162).trim();
            
            if (idPrefix) {
                const amount = parseCnabCurrency(line.substring(107, 122)); // pos 108-122
                const date = parseCnabDate(line.substring(99, 107)); // pos 100-107
                const occurrenceCode = line.substring(230, 232).trim() || '00';
                const { desc, isSuccess, isRejected } = getSegmentJOccurrenceDesc(occurrenceCode);

                let status: ParsedReturnItem['status'] = 'pending';
                if (isSuccess) status = 'paid';
                else if (isRejected) status = 'rejected';

                results.push({
                    idPrefix,
                    nossoNumero,
                    amount,
                    originalAmount: amount,
                    date,
                    status,
                    occurrenceCode,
                    occurrenceDescription: desc,
                    segmentType: 'O'
                });
            }
        }

        // ──────── Segmento T (Cobrança / Contas a Receber) ────────
        else if (segmentType === 'T') {
            const movementCode = line.substring(15, 17); // pos 16-17
            // Nosso Número is pos 38-57 (index 37 to 57)
            const nossoNumero = line.substring(37, 57).trim();
            // "Seu Número" (Número do Documento) is pos 59-73 (index 58 to 73)
            const idPrefix = line.substring(58, 73).trim();
            const originalAmount = parseCnabCurrency(line.substring(81, 96)); // pos 82-96

            if (idPrefix) {
                lastSegmentT = {
                    idPrefix,
                    nossoNumero,
                    originalAmount,
                    movementCode,
                    lote,
                    seq
                };
            } else {
                lastSegmentT = null;
            }
        }

        // ──────── Segmento U (Cobrança / Contas a Receber - Valor Pago) ────────
        else if (segmentType === 'U') {
            // Segment U must follow Segment T of the same transaction
            if (lastSegmentT && lastSegmentT.lote === lote) {
                // Juros/Multa: pos 18-32
                const interestPenalty = parseCnabCurrency(line.substring(17, 32));
                // Desconto: pos 33-47
                const discount = parseCnabCurrency(line.substring(32, 47));
                // Valor Pago: pos 78-92
                const amount = parseCnabCurrency(line.substring(77, 92));
                // Data da Ocorrência/Pagamento: pos 138-145
                const date = parseCnabDate(line.substring(137, 145));

                const { desc, isSuccess, isRejected } = getSegmentTMovementDesc(lastSegmentT.movementCode);

                let status: ParsedReturnItem['status'] = 'pending';
                if (isSuccess) status = 'received';
                else if (isRejected) status = 'rejected';

                results.push({
                    idPrefix: lastSegmentT.idPrefix,
                    nossoNumero: lastSegmentT.nossoNumero,
                    amount: amount > 0 ? amount : lastSegmentT.originalAmount,
                    originalAmount: lastSegmentT.originalAmount,
                    date,
                    status,
                    occurrenceCode: lastSegmentT.movementCode,
                    occurrenceDescription: desc,
                    segmentType: 'T/U',
                    interest: interestPenalty,
                    discount
                });

                lastSegmentT = null; // Clear so we don't reuse it
            }
        }
    }

    return results;
}
