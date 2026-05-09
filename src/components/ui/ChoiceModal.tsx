import React from 'react';
import { X, ChevronRight, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface Choice {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    variant?: 'primary' | 'danger' | 'info';
}

interface ChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    choices: Choice[];
    onSelect: (id: string) => void;
}

export function ChoiceModal({ isOpen, onClose, title, description, choices, onSelect }: ChoiceModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <HelpCircle size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
                            {description}
                        </p>
                    )}

                    <div className="space-y-3">
                        {choices.map((choice) => (
                            <button
                                key={choice.id}
                                onClick={() => onSelect(choice.id)}
                                className={clsx(
                                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group",
                                    choice.variant === 'danger' 
                                        ? "border-rose-50 hover:border-rose-200 bg-rose-50/30 hover:bg-rose-50/50 dark:border-rose-900/10 dark:hover:border-rose-900/30" 
                                        : "border-gray-50 hover:border-blue-200 bg-gray-50/30 hover:bg-blue-50/30 dark:border-slate-800 dark:hover:border-blue-900/30"
                                )}
                            >
                                {choice.icon && (
                                    <div className={clsx(
                                        "p-2 rounded-xl shrink-0 transition-colors",
                                        choice.variant === 'danger' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                                    )}>
                                        {choice.icon}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                        "font-bold text-sm",
                                        choice.variant === 'danger' ? "text-rose-700 dark:text-rose-400" : "text-gray-900 dark:text-white"
                                    )}>{choice.label}</p>
                                    {choice.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{choice.description}</p>}
                                </div>
                                <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-50/50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-center">
                    <Button variant="ghost" onClick={onClose} className="text-xs font-bold text-gray-500">
                        Cancelar Operação
                    </Button>
                </div>
            </div>
        </div>
    );
}
