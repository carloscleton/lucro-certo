import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { formatBRL, parseBRL } from '../../utils/currencyUtils';

interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    leftElement?: React.ReactNode;
    label?: string;
    error?: string;
    required?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
    value, 
    onChange, 
    className, 
    leftElement,
    label,
    error,
    required
}) => {
    const [displayValue, setDisplayValue] = useState(formatBRL(value));
    const [isFocused, setIsFocused] = useState(false);

    // Sync with external value changes (e.g. from parent or AI analysis)
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(formatBRL(value));
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        // When focusing, show a cleaner version for editing (still with comma if needed, but not forced .00 if not wished?)
        // Actually, showing the formatted version is fine, as long as we don't force-format DURING typing.
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
        // Allow numeric entry including comma/dot
        if (/^[0-9,.]*$/.test(val) || val === '') {
            setDisplayValue(val);
            // Optionally update parent on every keystroke if needed for totals
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
            className={className}
            leftElement={leftElement}
            placeholder="0,00"
        />
    );
};
