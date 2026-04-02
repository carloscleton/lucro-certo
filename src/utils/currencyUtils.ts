export const formatBRL = (value: number | string): string => {
    const number = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(number)) return '0,00';
    return new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

export const parseBRL = (value: string): number => {
    // Determine the decimal separator based on the locale
    const locale = window.__CURRENCY_LOCALE__ || 'pt-BR';
    const isEn = locale.startsWith('en');
    
    let cleanValue = value.replace(/[^\d,.-]/g, '');
    if (!isEn) {
        cleanValue = cleanValue.replace(',', '.');
    }
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
};
