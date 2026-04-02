import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { formatBRL, parseBRL } from '../../utils/currencyUtils';
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
                "font-bold text-base h-11",
                'pr-14',
                className
            )}
            leftElement={leftElement}
            rightElement={
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-gray-200 dark:border-slate-700 select-none">
                    <span className="text-xs">{FLAGS[currencyCode] || '💰'}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{currencyCode}</span>
                </div>
            }
            placeholder={placeholder || ( (window.__CURRENCY_LOCALE__ || 'pt-BR').startsWith('en') ? "0.00" : "0,00" )}
            {...props}
        />
    );
};

