import { generateCnab240, CompanyBankInfo, PaymentItem } from '../src/services/cnab/cnab240Generator';

const bankLinha = "00190000090279634000400000021606196230000018500";
const utilityLinha = "846700000027179901090117006899723018244583940428";

const company: CompanyBankInfo = {
    cnpj: "12345678000199",
    legal_name: "MINHA EMPRESA LTDA",
    bankCode: "077",
    agency: "0001",
    agency_dv: "9",
    account: "1234567",
    account_dv: "8",
    company_code: "CONVENIO12345"
};

const payments: PaymentItem[] = [
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
const segmentO = lines[2]; // Line 1: Header, Line 2: Lot Header, Line 3: Segment O

console.log("Segment O Line (length: " + segmentO.length + "):");
console.log(segmentO);

console.log("\nFields break down:");
console.log("- Banco (1-3):", segmentO.substring(0, 3));
console.log("- Lote (4-7):", segmentO.substring(3, 7));
console.log("- Registro (8):", segmentO.substring(7, 8));
console.log("- Seq (9-13):", segmentO.substring(8, 13));
console.log("- Segmento (14):", segmentO.substring(13, 14));
console.log("- Branco (15):", segmentO.substring(14, 15));
console.log("- Inst (16-17):", segmentO.substring(15, 17));
console.log("- Barcode (18-61):", segmentO.substring(17, 61));
console.log("- Nome (62-91):", segmentO.substring(61, 91));
console.log("- Venc (92-99):", segmentO.substring(91, 99));
console.log("- Pag (100-107):", segmentO.substring(99, 107));
console.log("- Valor (108-122):", segmentO.substring(107, 122));
console.log("- Seu Num (123-142):", segmentO.substring(122, 142));
console.log("- Nosso Num (143-162):", segmentO.substring(142, 162));
console.log("- Exclusivo (163-230):", segmentO.substring(162, 230));
console.log("- Ocorrencias (231-240):", segmentO.substring(230, 240));
