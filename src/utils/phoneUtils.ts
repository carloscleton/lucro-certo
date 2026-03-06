export const formatPhoneInput = (value: string | undefined | null) => {
    if (!value) return '';

    // Remove tudo que não é dígito
    let v = value.replace(/\D/g, '');

    // Remove o 55 se vier com 55 e tiver mais de 10/11 dígitos
    if (v.startsWith('55') && v.length >= 12) {
        v = v.substring(2);
    }

    // Limita a 11 dígitos no máximo
    if (v.length > 11) v = v.substring(0, 11);

    // Formata
    if (v.length > 10) {
        // Celular: (XX) X XXXX-XXXX
        v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{4}).*/, '($1) $2 $3-$4');
    } else if (v.length > 6) {
        // Fixo: (XX) XXXX-XXXX
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 2) {
        // Digitando... (XX) XXXXX
        v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length > 0) {
        // Digitando DDD... (XX
        v = v.replace(/^(\d{0,2})/, '($1');
    }

    return v;
};

export const cleanPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    if (!digits.startsWith('55')) {
        digits = '55' + digits;
    }
    return digits;
};

export const formatPhoneFromDB = (phone: string | null | undefined) => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
        digits = digits.substring(2);
    }
    return formatPhoneInput(digits);
};
