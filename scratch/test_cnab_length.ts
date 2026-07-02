import { generateCnab240 } from '../src/services/cnab/cnab240Generator';

const mockCompany = {
    cnpj: '00893566000190',
    legal_name: 'CARLOSCLETON CARVALHO FERNANDES',
    bankCode: '077',
    agency: '0001',
    agency_dv: '0',
    account: '19531863',
    account_dv: '3',
    company_code: '12345'
};

const mockPayments = [
    {
        id: 'PAY-001',
        barcode: '07799000000000000000000000000000000000000000',
        amount: 1623.30,
        due_date: '2026-06-04',
        beneficiary_name: 'HUMANA SAUDE'
    }
];

try {
    const cnabContent = generateCnab240(mockCompany, mockPayments, 1);
    const lines = cnabContent.split('\r\n');
    console.log(`Total lines generated: ${lines.length}`);
    lines.forEach((line, idx) => {
        if (line) {
            console.log(`Line ${idx + 1} length: ${line.length} - ${line.substring(0, 15)}... (Type: ${line.substring(7, 8)})`);
            if (line.length !== 240) {
                console.error(`ERROR: Line ${idx + 1} length is ${line.length} instead of 240!`);
                process.exit(1);
            }
        }
    });
    console.log('SUCCESS: All lines are exactly 240 characters!');
} catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
}
