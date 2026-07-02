import { generateCnab240 } from '../src/services/cnab/cnab240Generator.js';

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

// Temporarily compiling or importing generator. Note that in tsconfig we target dist, but we can compile with tsc or run via node
// Let's just mock the generator test directly in a simple JS to inspect output line by line if we want, or run via tsc.
// Since it's easier to verify via a build, let's run npm run build. If build passes, let's test it.
console.log('Test file created.');
