import { generateCnab240, getFilenameForBank } from '../src/services/cnab/cnab240Generator';

// ─── TESTE 1: Nome do arquivo (getFilenameForBank) ───────────────────────────
console.log('=== TESTE 1: Nomenclatura de Arquivos ===');
const nameBB = getFilenameForBank('001', 5, 'rem');
const nameInter = getFilenameForBank('077', 5, 'rem');
const nameItau = getFilenameForBank('341', 5, 'txt');

console.log(`BB (001):    esperado: CI240_001_000005.REM | obtido: ${nameBB}`);
console.log(`Inter (077): esperado: CI240_001_000005.REM | obtido: ${nameInter}`);
console.log(`Itaú (341):  esperado: remessa_341_... | obtido: ${nameItau}`);

if (nameBB !== 'CI240_001_000005.REM' || nameInter !== 'CI240_001_000005.REM' || !nameItau.startsWith('remessa_341_')) {
    console.error('❌ Erro no Teste 1!');
    process.exit(1);
}
console.log('✅ Teste 1 OK!\n');

// ─── TESTE 2: Layout e Separação de Lotes ─────────────────────────────────────
console.log('=== TESTE 2: Geração de Layout e Lotes Separados ===');

const company = {
    cnpj:        '12345678000195',
    legal_name:  'EMPRESA TESTE LTDA',
    bankCode:    '077',           // Banco Inter
    agency:      '0001',
    agency_dv:   '0',
    account:     '123456789',
    account_dv:  '0',
    company_code: 'COD12345',
};

// Boleto Banco Inter (077)
const barcodeInter = '07790000025490625002000073000014676010000045000';
// Boleto Itaú (341)
const barcodeItau = '34191790010104351004791020150008291070026000';

const payments = [
    {
        id: 'pag-inter-1',
        barcode: barcodeInter,
        amount: 100.00,
        due_date: '2026-06-15',
        beneficiary_name: 'BENEFICIARIO INTER',
    },
    {
        id: 'pag-itau-1',
        barcode: barcodeItau,
        amount: 250.00,
        due_date: '2026-06-16',
        beneficiary_name: 'BENEFICIARIO ITAU',
    }
];

const cnabContent = generateCnab240(company, payments, 1);
const lines = cnabContent.split('\r\n').filter(l => l.length > 0);

console.log(`Total de linhas geradas: ${lines.length}`);

// Inspecionar Header do Arquivo (Registro 0)
const headerArq = lines[0];
const versionArq = headerArq.substring(163, 166);
console.log(`Layout Versão Arquivo (deve ser 080 para Inter/BB): "${versionArq}"`);

if (versionArq !== '080') {
    console.error('❌ Erro: Versão do layout do arquivo incorreta!');
    process.exit(1);
}

// Encontrar os lotes gerados
// Cada lote tem um Header (Registro 1) e um Trailer (Registro 5)
const headersLote = lines.filter(l => l[7] === '1');
console.log(`Total de lotes no arquivo: ${headersLote.length} (esperado: 2)`);

if (headersLote.length !== 2) {
    console.error('❌ Erro: Deveria ter gerado exatamente 2 lotes (próprio banco e outros bancos)!');
    process.exit(1);
}

const formaL1 = headersLote[0].substring(11, 13);
const formaL2 = headersLote[1].substring(11, 13);

console.log(`Forma de Lançamento Lote 1: "${formaL1}" (esperado: 30)`);
console.log(`Forma de Lançamento Lote 2: "${formaL2}" (esperado: 31)`);

if (formaL1 !== '30' || formaL2 !== '31') {
    console.error('❌ Erro: Formas de lançamento incorretas!');
    process.exit(1);
}

// Validar se todas as linhas possuem exatamente 240 caracteres
let lengthOk = true;
lines.forEach((line, i) => {
    if (line.length !== 240) {
        console.error(`Linha ${i + 1} possui tamanho incorreto: ${line.length}`);
        lengthOk = false;
    }
});

if (!lengthOk) {
    console.error('❌ Erro: Alguma linha não possui exatamente 240 caracteres!');
    process.exit(1);
}

console.log('✅ Teste 2 OK!');
console.log('\n🎉 Todos os testes passaram com sucesso!');
