import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helpText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
    ({ className, label, error, helpText, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1 w-full">
                {label && (
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={clsx(
                        'flex w-full rounded-md border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-main)] placeholder:text-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 uppercase',
                        error && 'border-red-500 focus:ring-red-500 dark:border-red-500',
                        className
                    )}
                    {...props}
                    onChange={(e) => {
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        e.target.value = e.target.value.toUpperCase();
                        e.target.setSelectionRange(start, end);
                        props.onChange?.(e);
                    }}
                />
                {helpText && <span className="text-xs text-gray-500 dark:text-gray-400">{helpText}</span>}
                {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
        );
    }
);

TextArea.displayName = 'TextArea';
