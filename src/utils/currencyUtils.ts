export const formatCurrency = (value: number | string): string => {
    const number = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(number)) return '0,00';
    
    // Get decimal count from currency if needed (e.g. PYG has 0)
    const code = (window as any).__CURRENCY_CODE__ || 'BRL';
    const decimals = code === 'PYG' ? 0 : 2;

    return new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number);
};

export const parseCurrency = (value: string): number => {
    // Determine the decimal separator based on the locale
    const locale = window.__CURRENCY_LOCALE__ || 'pt-BR';
    const isEn = locale.startsWith('en');
    
    // If it's English, the decimal is '.' and thousand is ','
    // Otherwise, we assume decimal is ',' and thousand is '.'
    
    let cleanValue = value.replace(/[^\d,.-]/g, '');
    if (!isEn) {
        // Swap comma to dot for parsing if not English
        // But we must be careful with multiple dots if they are thousand separators
        cleanValue = cleanValue.split('.').join('').replace(',', '.');
    } else {
        // If English, comma is thousand, remove it
        cleanValue = cleanValue.split(',').join('');
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
};

// Aliases for backward compatibility while we refactor
export const formatBRL = formatCurrency;
export const parseBRL = parseCurrency;

