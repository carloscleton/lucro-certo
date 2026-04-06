import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { formatCurrency, parseCurrency } from '../../utils/currencyUtils';
import clsx from 'clsx';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: number;
    onChange: (value: number) => void;
    leftElement?: React.ReactNode;
    label?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
}

const FLAGS: Record<string, string> = {
  BRL: '🇧🇷',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  PYG: '🇵🇾',
  ARS: '🇦🇷'
};

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
    value, 
    onChange, 
    className, 
    leftElement,
    label,
    error,
    required,
    placeholder,
    ...props
}) => {
    const currencyCode = (window as any).__CURRENCY_CODE__ || 'BRL';
    const [displayValue, setDisplayValue] = useState(formatCurrency(value));
    const [isFocused, setIsFocused] = useState(false);

    // Sync with external value changes
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(formatCurrency(value));
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        const locale = (window as any).__CURRENCY_LOCALE__ || 'pt-BR';
        const separator = locale.startsWith('en') ? '.' : ',';
        const decimals = currencyCode === 'PYG' ? 0 : 2;
        setDisplayValue(value === 0 ? '' : value.toFixed(decimals).replace('.', separator));
    };

    const handleBlur = () => {
        setIsFocused(false);
        const numericValue = parseCurrency(displayValue);
        setDisplayValue(formatCurrency(numericValue));
        onChange(numericValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const locale = (window as any).__CURRENCY_LOCALE__ || 'pt-BR';
        const separator = locale.startsWith('en') ? '.' : ',';
        
        // Allow numeric entry including dynamic separator
        const regex = new RegExp(`^[0-9${separator}]*$`);
        if (regex.test(val) || val === '') {
            setDisplayValue(val);
            const num = parseCurrency(val);
            onChange(num);
        }
    };

    return (
        <Input 
            type="text"
            label={label}
            error={error}
            required={required}
            value={displayValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={clsx(
                "font-bold text-base h-11 pl-16",
                className
            )}
            leftElement={
                <div className="flex items-center gap-1.5 opacity-60 ml-1 select-none pointer-events-none">
                    <span className="text-base">{FLAGS[currencyCode] || '💰'}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter">{currencyCode === 'BRL' ? 'R$' : currencyCode}</span>
                </div>
            }
            placeholder={placeholder || ( (window.__CURRENCY_LOCALE__ || 'pt-BR').startsWith('en') ? "0.00" : "0,00" )}
            {...props}
        />
    );
};

