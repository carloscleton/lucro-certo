import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { formatBRL, parseBRL } from '../../utils/currencyUtils';

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
    const [displayValue, setDisplayValue] = useState(formatBRL(value));
    const [isFocused, setIsFocused] = useState(false);

    // Sync with external value changes
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(formatBRL(value));
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        setDisplayValue(value === 0 ? '' : value.toString().replace('.', ','));
    };

    const handleBlur = () => {
        setIsFocused(false);
        const numericValue = parseBRL(displayValue);
        setDisplayValue(formatBRL(numericValue));
        onChange(numericValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9,.]*$/.test(val) || val === '') {
            setDisplayValue(val);
            const num = parseBRL(val);
            onChange(num);
        }
    };

    return (
        <div className="group relative">
            <Input 
                type="text"
                label={label}
                error={error}
                required={required}
                value={displayValue}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                className={`${className} pr-20 font-bold text-lg h-12 border-2 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/10`}
                leftElement={leftElement}
                placeholder={placeholder || ( (window.__CURRENCY_LOCALE__ || 'pt-BR').startsWith('en') ? "0.00" : "0,00" )}
                {...props}
            />
            <div className="absolute right-3 top-[32px] flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800/50 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 pointer-events-none select-none transition-transform group-focus-within:scale-105">
                <span className="text-base">{FLAGS[currencyCode] || '💰'}</span>
                <span className="text-xs font-black text-gray-500 dark:text-gray-400">{currencyCode}</span>
            </div>
        </div>
    );
};

