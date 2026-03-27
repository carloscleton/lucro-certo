export const formatBRL = (value: number | string): string => {
    const number = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(number)) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

export const parseBRL = (value: string): number => {
    const cleanValue = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
};
