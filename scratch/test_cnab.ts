import { validateBoleto, getBarcodeFromLinhaDigitavel, generateCnab240, CompanyBankInfo, PaymentItem } from '../src/services/cnab/cnab240Generator';
import { parseCnab240Return } from '../src/src/../services/cnab/cnabReturnParser'; // wait, it is in src/services/cnab/cnabReturnParser.ts

console.log("=== INICIANDO TESTES DO GERADOR CNAB ===");

// 1. Testar Linha Digitável Bancária (47 dígitos)
const bankLinha = "00190000090279634000400000021606196230000018500";
const bankResult = validateBoleto(bankLinha);
console.log("\n[TESTE 1] Boleto Bancário:");
console.log("- Tipo detectado:", bankResult.type);
console.log("- Válido?", bankResult.isValid);
console.log("- Código Barras (44):", bankResult.barcode);
console.log("- Erros:", bankResult.errors);

// 2. Testar Linha Digitável Concessionária (48 dígitos)
const utilityLinha = "846700000027179901090117006899723018244583940428"; // Exemplo real
const utilityResult = validateBoleto(utilityLinha);
console.log("\n[TESTE 2] Boleto Concessionária (TIM):");
console.log("- Tipo detectado:", utilityResult.type);
console.log("- Válido?", utilityResult.isValid);
console.log("- Código Barras (44):", utilityResult.barcode);
console.log("- Erros:", utilityResult.errors);

// 3. Testar Geração do CNAB
const company: CompanyBankInfo = {
    cnpj: "12345678000199",
    legal_name: "MINHA EMPRESA LTDA",
    bankCode: "077", // Banco Inter
    agency: "0001",
    agency_dv: "9",
    account: "1234567",
    account_dv: "8",
    company_code: "CONVENIO12345"
};

const payments: PaymentItem[] = [
    {
        id: "EXP001",
        linha_digitavel: bankLinha,
        amount: 185.00,
        due_date: "2026-06-15",
        beneficiary_name: "FORNECEDOR DE SERVICOS"
    },
    {
        id: "EXP002",
        linha_digitavel: utilityLinha,
        amount: 27.00,
        due_date: "2026-06-20",
        beneficiary_name: "TIM TELEFONIA S/A"
    }
];

const cnab = generateCnab240(company, payments, 1);
const lines = cnab.split('\r\n');

console.log("\n[TESTE 3] Arquivo CNAB Gerado:");
console.log("- Total de linhas:", lines.length);

let all240 = true;
lines.forEach((line, idx) => {
    if (line.length !== 240) {
        console.log(`- ERRO: Linha ${idx + 1} tem ${line.length} caracteres!`);
        all240 = false;
    }
});
if (all240) {
    console.log("- Sucesso: Todas as linhas possuem exatamente 240 caracteres.");
}

// Analisar os registros gerados
console.log("\n- Estrutura de registros:");
lines.forEach((line, idx) => {
    if (line.length === 240) {
        const type = line.substring(7, 8); // Tipo de Registro
        const segment = line.substring(13, 14); // Segmento se detalhe
        const lot = line.substring(3, 7); // Lote
        if (idx === 0) console.log(`  Linha ${idx+1}: Header de Arquivo (Lote ${lot})`);
        else if (idx === lines.length - 1) console.log(`  Linha ${idx+1}: Trailer de Arquivo (Lote ${lot})`);
        else if (type === '1') console.log(`  Linha ${idx+1}: Header de Lote ${lot}`);
        else if (type === '5') console.log(`  Linha ${idx+1}: Trailer de Lote ${lot}`);
        else if (type === '3') console.log(`  Linha ${idx+1}: Detalhe Segmento ${segment} (Lote ${lot})`);
    }
});

// 4. Testar Importação de Retorno CNAB
console.log("\n[TESTE 4] Simulação de Retorno CNAB:");
const fakeReturnContent = lines.map(line => {
    const type = line.substring(7, 8);
    const segment = line.substring(13, 14);
    if (type === '3') {
        if (segment === 'J') {
            // Configurar código de ocorrência para "00" (sucesso) nas posições 231-232
            return line.substring(0, 230) + "00" + line.substring(232);
        } else if (segment === 'O') {
            // Configurar código de ocorrência para "00" (sucesso) nas posições 231-232
            return line.substring(0, 230) + "00" + line.substring(232);
        }
    }
    return line;
}).join('\r\n');

try {
    const parsedReturn = parseCnab240Return(fakeReturnContent);
    console.log("- Transações processadas do retorno:", parsedReturn.length);
    parsedReturn.forEach(item => {
        console.log(`  * ID: ${item.idPrefix} | Segmento: ${item.segmentType} | Status: ${item.status} | Valor: ${item.amount} | Msg: ${item.occurrenceDescription}`);
    });
} catch (err) {
    console.error("- Erro ao parsear retorno:", err);
}
