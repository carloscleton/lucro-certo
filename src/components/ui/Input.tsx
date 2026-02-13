import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
    rightElement?: React.ReactNode;
    preserveCase?: boolean; // Don't convert to uppercase
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helpText, rightElement, preserveCase = false, containerClassName, ...props }, ref) => {
        return (
            <div className={clsx("flex flex-col gap-1 w-full", containerClassName)}>
                {label && (
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    <input
                        ref={ref}
                        className={clsx(
                            'flex h-10 w-full rounded-md border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-main)] placeholder:text-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
                            error && 'border-red-500 focus:ring-red-500 dark:border-red-500',
                            !['password', 'email', 'date', 'number', 'time', 'datetime-local'].includes(props.type || 'text') && !preserveCase && 'uppercase',
                            rightElement && 'pr-10',
                            className
                        )}
                        {...props}
                        onChange={(e) => {
                            // Types that don't support selection range or unnecessary for uppercase
                            const excludedTypes = ['password', 'email', 'date', 'number', 'month', 'week', 'time', 'datetime-local', 'color', 'file'];

                            const inputType = e.target.type || props.type || 'text';
                            if (!excludedTypes.includes(inputType) && !preserveCase) {
                                const start = e.target.selectionStart;
                                const end = e.target.selectionEnd;
                                e.target.value = e.target.value.toUpperCase();
                                // Only set selection if supported (though excludedTypes should cover it)
                                if (start !== null && end !== null) {
                                    e.target.setSelectionRange(start, end);
                                }
                            }
                            props.onChange?.(e);
                        }}
                    />
                    {rightElement && (
                        <div className="absolute right-3 flex items-center justify-center">
                            {rightElement}
                        </div>
                    )}
                </div>
                {helpText && <span className="text-xs text-gray-500 dark:text-gray-400">{helpText}</span>}
                {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
