function formatWhatsappNumber(phone: string | null | undefined): string {
    if (!phone) return '';
    let clean = String(phone).replace(/\D/g, '');
    
    // Se não tiver o DDI 55 e tiver 10 ou 11 dígitos, adiciona o 55
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    
    // Se for do Brasil (começa com 55) e tiver 13 dígitos (com o 9º dígito)
    if (clean.startsWith('55') && clean.length === 13) {
        const ddd = parseInt(clean.substring(2, 4), 10);
        // Se o DDD for maior que 28, remove o 9º dígito
        if (ddd > 28) {
            clean = clean.substring(0, 4) + clean.substring(5);
        }
    }
    
    return clean;
}

console.log("5584998071213 -> expected: 558498071213 | actual:", formatWhatsappNumber("5584998071213"));
console.log("84998071213 -> expected: 558498071213 | actual:", formatWhatsappNumber("84998071213"));
console.log("558498071213 -> expected: 558498071213 | actual:", formatWhatsappNumber("558498071213"));
console.log("5511999999999 -> expected: 5511999999999 | actual:", formatWhatsappNumber("5511999999999"));
console.log("11999999999 -> expected: 5511999999999 | actual:", formatWhatsappNumber("11999999999"));
