import { generateCnab240 } from '../src/services/cnab/cnab240Generator';

// ─── Dados de teste ───────────────────────────────────────────────────────────
const company = {
    cnpj:        '12345678000195',
    legal_name:  'EMPRESA TESTE LTDA',
    bankCode:    '077',           // Banco Inter
    agency:      '0001',
    agency_dv:   '0',
    account:     '123456789',
    account_dv:  '0',
    company_code: 'COD0001234567890000', // Código de convênio/transmissão
};

// Boleto real de exemplo (44 dígitos) — banco Itaú
const barcodeItau = '34191790010104351004791020150008291070026000';
// Boleto Banco Inter (077)
const barcodeInter = '07790000025490625002000073000014676010000045000';

const payments = [
    {
        id: 'f47ac10b-58cc-4372-a567',
        barcode: barcodeItau,
        amount: 1500.00,
        due_date: '2026-06-15',
        beneficiary_name: 'FORNECEDOR ABC',
    },
];

// ─── Gera o arquivo ───────────────────────────────────────────────────────────
const cnabContent = generateCnab240(company, payments, 5);
const lines = cnabContent.split('\r\n').filter(l => l.length > 0);

console.log('=== VALIDAÇÃO DO CNAB 240 GERADO ===\n');
console.log(`Total de linhas: ${lines.length}`);

let allOk = true;

lines.forEach((line, i) => {
    const len = line.length;
    const ok = len === 240;
    if (!ok) allOk = false;
    const tipoReg = line[7];
    const segmento = tipoReg === '3' ? ` | Seg: ${line[13]}` : '';
    const status = ok ? '✅' : `❌ (${len} chars!)`;
    console.log(`  Linha ${String(i+1).padStart(2)}: ${status} | Tipo: ${tipoReg}${segmento}`);
});

// ─── Inspeciona campos críticos ───────────────────────────────────────────────
console.log('\n=== INSPEÇÃO DE CAMPOS CRÍTICOS ===\n');

const headerArquivo = lines[0];
console.log('HEADER ARQUIVO (Registro 0):');
console.log(`  Banco (1-3):         "${headerArquivo.substring(0, 3)}"`);
console.log(`  Inscrição Empresa (18-31): "${headerArquivo.substring(17, 31)}"`);
console.log(`  Código Convênio (32-51):   "${headerArquivo.substring(31, 51)}"`);
console.log(`  Nome Empresa (73-102):     "${headerArquivo.substring(72, 102)}"`);
console.log(`  Versão Layout (163-165):   "${headerArquivo.substring(162, 165)}"`);

const headerLote = lines[1];
console.log('\nHEADER LOTE (Registro 1):');
console.log(`  Tipo Operação (9):        "${headerLote.substring(8, 9)}"`);
console.log(`  Tipo Serviço (10-11):     "${headerLote.substring(9, 11)}"`);
console.log(`  Forma Lançamento (12-13): "${headerLote.substring(11, 13)}"  ← deve ser '31'`);
console.log(`  Versão Layout Lote (14-16): "${headerLote.substring(13, 16)}"  ← deve ser '040'`);

const segJ = lines[2];
console.log('\nSEGMENTO J (1º detalhe):');
console.log(`  Banco (1-3):         "${segJ.substring(0, 3)}"`);
console.log(`  Segmento (14):       "${segJ.substring(13, 14)}"  ← deve ser 'J'`);
console.log(`  Código Barras (18-61): "${segJ.substring(17, 61)}"`);
const expectedBc44 = barcodeItau.substring(0, 44);
const gotBc44 = segJ.substring(17, 61);
const bcOk = gotBc44 === expectedBc44;
console.log(`  Barcode esperado:    "${expectedBc44}"`);
console.log(`  Barcode OK: ${bcOk ? '✅' : '❌'}`);
console.log(`  Valor Título (100-114): "${segJ.substring(99, 114)}"`);  // deve ser R$1500.00 em centavos
console.log(`  Valor Pagamento (153-167): "${segJ.substring(152, 167)}"`);
console.log(`  Seu Número (183-202): "${segJ.substring(182, 202)}"`);

const trailerLote = lines[lines.length - 2];
console.log('\nTRAILER LOTE (Registro 5):');
console.log(`  Qtd Registros (9-14): "${trailerLote.substring(8, 14)}"`);
console.log(`  Valor Total (15-32):  "${trailerLote.substring(14, 32)}"`);

const trailerArq = lines[lines.length - 1];
console.log('\nTRAILER ARQUIVO (Registro 9):');
console.log(`  Qtd Lotes (10-15):     "${trailerArq.substring(9, 15)}"`);
console.log(`  Qtd Registros (16-21): "${trailerArq.substring(15, 21)}"`);

console.log('\n=== RESULTADO FINAL ===');
if (allOk) {
    console.log('✅ TODAS AS LINHAS TÊM 240 CARACTERES — arquivo válido!');
} else {
    console.log('❌ EXISTEM LINHAS COM TAMANHO INCORRETO — corrija antes de enviar!');
    process.exit(1);
}
