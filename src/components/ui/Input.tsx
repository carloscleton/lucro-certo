import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    preserveCase?: boolean; // Don't convert to uppercase
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helpText, leftElement, rightElement, preserveCase = false, containerClassName, ...props }, ref) => {
        return (
            <div className={clsx("flex flex-col gap-1 w-full", containerClassName)}>
                {label && (
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    {leftElement && (
                        <div className="absolute left-3 flex items-center justify-center pointer-events-none z-10 text-gray-400">
                            {leftElement}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={clsx(
                            'flex h-10 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/80 px-3.5 py-2 text-sm font-semibold text-[var(--color-text-main)] placeholder:text-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-violet-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-violet-500/15 hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all',
                            error && 'border-red-500 focus:ring-red-500 dark:border-red-500',
                            !['password', 'email', 'date', 'number', 'time', 'datetime-local'].includes(props.type || 'text') && !preserveCase && 'uppercase',
                            leftElement && 'pl-10',
                            rightElement && 'pr-14',
                            className
                        )}
                        {...props}
                        onPaste={(e) => {
                            props.onPaste?.(e);
                            if (e.defaultPrevented) return;

                            const pastedText = e.clipboardData.getData('text');
                            if (pastedText && /[\r\n\t\u00A0\u200B]/.test(pastedText)) {
                                e.preventDefault();
                                const cleanedPasted = pastedText
                                    .replace(/[\r\n\t\u00A0\u200B]+/g, ' ')
                                    .replace(/  +/g, ' ');

                                const target = e.currentTarget;
                                const start = target.selectionStart ?? target.value.length;
                                const end = target.selectionEnd ?? target.value.length;

                                const currentValue = target.value;
                                const newValue = currentValue.slice(0, start) + cleanedPasted + currentValue.slice(end);

                                const excludedTypes = ['password', 'email', 'date', 'number', 'month', 'week', 'time', 'datetime-local', 'color', 'file'];
                                const inputType = target.type || props.type || 'text';
                                const finalValue = !excludedTypes.includes(inputType) && !preserveCase
                                    ? newValue.toUpperCase()
                                    : newValue;

                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                nativeInputValueSetter?.call(target, finalValue);

                                target.dispatchEvent(new Event('input', { bubbles: true }));

                                const newCursorPos = start + cleanedPasted.length;
                                try {
                                    target.setSelectionRange(newCursorPos, newCursorPos);
                                } catch (err) {
                                    // Selection range might fail on unsupported input types
                                }
                            }
                        }}
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
