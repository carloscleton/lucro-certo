import { modulo10, modulo11Utility } from '../src/services/cnab/cnab240Generator';

const barcode = "84670000002179901090110068997230124458394042";
console.log("Barcode:", barcode);
console.log("Length:", barcode.length);

const firstPart = barcode.substring(0, 3); // "846"
const secondPart = barcode.substring(4);   // Everything after DV
const barcodeWithoutDv = firstPart + secondPart; // 43 digits

console.log("Barcode without DV (43 chars):", barcodeWithoutDv);
console.log("Length:", barcodeWithoutDv.length);

const dvMod10 = modulo10(barcodeWithoutDv);
console.log("Calculated DV (Mod 10):", dvMod10);

const dvMod11 = modulo11Utility(barcodeWithoutDv);
console.log("Calculated DV (Mod 11):", dvMod11);

console.log("Actual DV in barcode (index 3):", barcode[3]);
