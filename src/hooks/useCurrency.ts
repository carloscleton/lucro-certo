import { useEntity } from '../context/EntityContext';

const currencyConfig: Record<string, { locale: string; format: Intl.NumberFormatOptions }> = {
    BRL: { locale: 'pt-BR', format: { style: 'currency', currency: 'BRL' } },
    USD: { locale: 'en-US', format: { style: 'currency', currency: 'USD' } },
    EUR: { locale: 'pt-PT', format: { style: 'currency', currency: 'EUR' } },
    PYG: { locale: 'es-PY', format: { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 } },
    ARS: { locale: 'es-AR', format: { style: 'currency', currency: 'ARS' } },
};

export const useCurrency = () => {
    const { currentEntity } = useEntity();
    const currency = currentEntity.currency || 'BRL';

    const formatCurrency = (value: number | string): string => {
        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        if (isNaN(numValue)) return '0,00';

        const config = currencyConfig[currency] || currencyConfig.BRL;
        return new Intl.NumberFormat(config.locale, config.format).format(numValue);
    };

    const parseCurrency = (value: string): number => {
        // Simple extraction for now that works with most formats
        const cleanValue = value.replace(/[^\d,.-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? 0 : parsed;
    };

    return {
        formatCurrency,
        parseCurrency,
        currency
    };
};
