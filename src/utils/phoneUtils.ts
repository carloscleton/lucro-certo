export const formatPhoneInput = (value: string | undefined | null) => {
    if (!value) return '';

    let v = value.replace(/\D/g, '');

    // Auto-add 55 if it looks like a BR number without prefix
    if (v.length > 0 && !v.startsWith('55') && v.length <= 11) {
        v = '55' + v;
    }

    if (v.startsWith('55')) {
        const country = v.substring(0, 2);
        const rest = v.substring(2, 13);
        
        if (rest.length <= 10) {
            // Fixo: +55 (XX) XXXX-XXXX
            let result = `+${country}`;
            if (rest.length > 0) result += ` (${rest.substring(0, 2)}`;
            if (rest.length > 2) result += `) ${rest.substring(2, 6)}`;
            if (rest.length > 6) result += `-${rest.substring(6, 10)}`;
            return result;
        } else {
            // Celular: +55 (XX) XXXXX-XXXX
            let result = `+${country}`;
            if (rest.length > 0) result += ` (${rest.substring(0, 2)}`;
            if (rest.length > 2) result += `) ${rest.substring(2, 7)}`;
            if (rest.length > 7) result += `-${rest.substring(7, 11)}`;
            return result;
        }
    }

    // Fallback for other countries or raw typing
    if (v.length > 10) {
        return v.replace(/^(\d{2})(\d{1})(\d{4})(\d{4}).*/, '($1) $2 $3-$4');
    } else if (v.length > 6) {
        return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 0) {
        return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    }

    return v;
};

export const formatPhoneWhatsapp = (val: string | undefined | null): string => {
    if (!val) return '';
    let digits = String(val).replace(/\D/g, '');
    if (!digits) return '';

    // Se o usuário digitou sem 55, mas já possui 10 ou 11 dígitos (DDD + Número), insere o 55 automaticamente
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = '55' + digits;
    }

    if (digits.startsWith('55')) {
        const ddi = '55';
        const ddd = digits.slice(2, 4);
        const rest = digits.slice(4);

        if (!ddd) return `${ddi}`;
        if (rest.length === 0) return `${ddi} (${ddd})`;
        if (rest.length <= 4) return `${ddi} (${ddd}) ${rest}`;
        if (rest.length === 5) return `${ddi} (${ddd}) ${rest.slice(0, 1)} ${rest.slice(1)}`;
        if (rest.length === 8) {
            // Fixo: 55 (84) 3084-5723
            return `${ddi} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
        }
        if (rest.length >= 9) {
            // Celular de 9 dígitos: 55 (84) 9 9807-1213
            return `${ddi} (${ddd}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
        }
        return `${ddi} (${ddd}) ${rest}`;
    }

    // Digitação parcial sem 55 durante o preenchimento (ex: 84...)
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

export const cleanPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
        digits = '55' + digits;
    }
    return digits;
};

export const formatPhoneFromDB = (phone: string | null | undefined) => {
    if (!phone) return '';
    return formatPhoneWhatsapp(phone);
};
