import { validateBoleto } from '../src/services/cnab/cnab240Generator';

const barcode = "214210028312008423660242142100011181541505202604";
const validation = validateBoleto(barcode);
console.log("Validation result:", JSON.stringify(validation, null, 2));
