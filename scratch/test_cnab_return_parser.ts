import { parseCnab240Return } from '../src/services/cnab/cnabReturnParser';

const padNum = (val: number | string, length: number): string => {
    const clean = String(val).replace(/\D/g, '');
    return clean.padStart(length, '0');
};

const padAlpha = (val: string, length: number): string => {
    return val.padEnd(length, ' ');
};

// Helper to construct Segment J
// Febraban 240 positions:
// 1-3: Banco (3)
// 4-7: Lote (4)
// 8: Registro (1)
// 9-13: Seq (5)
// 14: Segmento (1)
// 15: Mov (1)
// 16-17: Inst (2)
// 18-61: Barcode/Campo Livre (44)
// 62-91: Cedente (30)
// 92-99: Vencimento (8)
// 100-114: Valor Nominal (15)
// 115-129: Desconto (15)
// 130-144: Mora (15)
// 145-152: Data Pagamento (8)
// 153-167: Valor Pagamento (15)
// 168-182: Qtd Moeda (15)
// 183-202: Seu Número (20)
// 203-222: Nosso Número (20)
// 223-224: Moeda (2)
// 225-230: Reservado (6)
// 231-240: Ocorrência (10)
const buildSegmentJ = (args: {
    seq: number;
    dueDate: string;
    nominalAmount: number;
    paidAmount: number;
    paymentDate: string;
    seuNumero: string;
    nossoNumero: string;
    occurrence: string;
}): string => {
    let line = '';
    line += padNum('077', 3); // Banco
    line += padNum(1, 4); // Lote
    line += '3'; // Registro Detalhe
    line += padNum(args.seq, 5); // Seq
    line += 'J'; // Segmento
    line += '0'; // Movimento
    line += '00'; // Instrução
    line += padAlpha('', 44); // Barcode/Campo Livre
    line += padAlpha('FORNECEDOR', 30); // Cedente
    line += padNum(args.dueDate, 8); // Vencimento (DDMMAAAA)
    line += padNum(Math.round(args.nominalAmount * 100), 15); // Valor Nominal
    line += padNum(0, 15); // Desconto
    line += padNum(0, 15); // Mora
    line += padNum(args.paymentDate, 8); // Data Pagamento (DDMMAAAA)
    line += padNum(Math.round(args.paidAmount * 100), 15); // Valor Pagamento
    line += padNum(0, 15); // Qtd Moeda
    line += padAlpha(args.seuNumero, 20); // Seu Número
    line += padAlpha(args.nossoNumero, 20); // Nosso Número
    line += '09'; // Moeda (Real)
    line += padAlpha('', 6); // Reservado
    line += padAlpha(args.occurrence, 10); // Ocorrência
    return line;
};

// Helper to construct Segment T
// 1-3: Banco (3)
// 4-7: Lote (4)
// 8: Registro (1)
// 9-13: Seq (5)
// 14: Segmento (1)
// 15: Reservado (1)
// 16-17: Movimento (2)
// 18-22: Agência (5)
// 23: DV Agência (1)
// 24-35: Conta (12)
// 36: DV Conta (1)
// 37: DV Ag/Conta (1)
// 38-57: Nosso Número (20)
// 58: Carteira (1)
// 59-73: Seu Número (15)
// 74-81: Vencimento (8)
// 82-96: Valor Nominal (15)
// 97-240: rest (144)
const buildSegmentT = (args: {
    seq: number;
    mov: string;
    nossoNumero: string;
    seuNumero: string;
    dueDate: string;
    nominalAmount: number;
}): string => {
    let line = '';
    line += padNum('077', 3);
    line += padNum(1, 4);
    line += '3';
    line += padNum(args.seq, 5);
    line += 'T';
    line += ' ';
    line += padNum(args.mov, 2);
    line += padNum('0077', 5);
    line += '0';
    line += padNum('12345', 12);
    line += '6';
    line += ' ';
    line += padAlpha(args.nossoNumero, 20);
    line += '1';
    line += padAlpha(args.seuNumero, 15);
    line += padNum(args.dueDate, 8);
    line += padNum(Math.round(args.nominalAmount * 100), 15);
    line += padAlpha('', 144);
    return line;
};

// Helper to construct Segment U
// 1-3: Banco (3)
// 4-7: Lote (4)
// 8: Registro (1)
// 9-13: Seq (5)
// 14: Segmento (1)
// 15: Reservado (1)
// 16-17: Movimento (2)
// 18-32: Juros/Multa (15)
// 33-47: Desconto (15)
// 48-77: Outros (30)
// 78-92: Valor Pago (15)
// 93-137: rest (45)
// 138-145: Data Ocorrência (8)
// 146-240: rest (95)
const buildSegmentU = (args: {
    seq: number;
    mov: string;
    interest: number;
    discount: number;
    paidAmount: number;
    paymentDate: string;
}): string => {
    let line = '';
    line += padNum('077', 3);
    line += padNum(1, 4);
    line += '3';
    line += padNum(args.seq, 5);
    line += 'U';
    line += ' ';
    line += padNum(args.mov, 2);
    line += padNum(Math.round(args.interest * 100), 15);
    line += padNum(Math.round(args.discount * 100), 15);
    line += padAlpha('', 30);
    line += padNum(Math.round(args.paidAmount * 100), 15);
    line += padAlpha('', 45);
    line += padNum(args.paymentDate, 8);
    line += padAlpha('', 95);
    return line;
};

const header = padAlpha('077HEADER', 240);
const loteHeader = padAlpha('077LOTEHEADER', 240);

const segJSuccess = buildSegmentJ({
    seq: 1,
    dueDate: '06062026',
    nominalAmount: 155.00,
    paidAmount: 155.00,
    paymentDate: '06062026',
    seuNumero: 'expense-12345',
    nossoNumero: '9999988888',
    occurrence: '00' // Success
});

const segJReject = buildSegmentJ({
    seq: 2,
    dueDate: '06062026',
    nominalAmount: 450.00,
    paidAmount: 450.00,
    paymentDate: '06062026',
    seuNumero: 'expense-rejected',
    nossoNumero: '9999988887',
    occurrence: 'HN' // Barcode Invalid
});

const segT = buildSegmentT({
    seq: 3,
    mov: '06', // Liquidação
    nossoNumero: '88888888',
    seuNumero: 'income-789',
    dueDate: '06062026',
    nominalAmount: 350.00
});

const segU = buildSegmentU({
    seq: 4,
    mov: '06',
    interest: 5.00,
    discount: 0.00,
    paidAmount: 355.00,
    paymentDate: '06062026'
});

const loteTrailer = padAlpha('077LOTETRAILER', 240);
const trailer = padAlpha('077TRAILER', 240);

const fileContent = [header, loteHeader, segJSuccess, segJReject, segT, segU, loteTrailer, trailer].join('\r\n');

const parsed = parseCnab240Return(fileContent);
console.log('\n--- Parsed Results:');
console.log(JSON.stringify(parsed, null, 2));

if (parsed.length !== 3) {
    console.error('FAIL: Expected 3 parsed transactions, got', parsed.length);
    process.exit(1);
}

const p1 = parsed[0];
if (p1.idPrefix !== 'expense-12345' || p1.status !== 'paid' || p1.amount !== 155 || p1.date !== '2026-06-06') {
    console.error('FAIL: Segment J success matching failed', p1);
    process.exit(1);
}

const p2 = parsed[1];
if (p2.idPrefix !== 'expense-rejected' || p2.status !== 'rejected' || p2.occurrenceCode !== 'HN') {
    console.error('FAIL: Segment J reject matching failed', p2);
    process.exit(1);
}

const p3 = parsed[2];
if (p3.idPrefix !== 'income-789' || p3.status !== 'received' || p3.amount !== 355 || p3.interest !== 5 || p3.date !== '2026-06-06') {
    console.error('FAIL: Segment T/U matching failed', p3);
    process.exit(1);
}

console.log('\n✅ ALL PARSER TESTS PASSED!');
