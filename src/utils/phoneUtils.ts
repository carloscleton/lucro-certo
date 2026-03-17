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
    return formatPhoneInput(phone);
};
