import React from 'react';
import { X, Copy, ChevronRight, Terminal } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface Step {
    title: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    msg?: string;
}

interface DiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    steps: Step[];
    logs: string[];
    action?: {
        label: string;
        onClick: () => void;
        visible: boolean;
        variant?: 'primary' | 'warning' | 'success';
    };
}

export function DiagnosticModal({ isOpen, onClose, title, description, steps, logs, action }: DiagnosticModalProps) {
    if (!isOpen) return null;

    const copyLogs = () => {
        navigator.clipboard.writeText(logs.join('\n'));
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                            <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                            {description && <p className="text-xs text-gray-500">{description}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Steps List */}
                    <div className="space-y-3">
                        {steps.map((step, idx) => (
                            <div key={idx} className={clsx(
                                "flex items-start gap-3 p-3 rounded-2xl border transition-all",
                                step.status === 'success' ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20" :
                                step.status === 'error' ? "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20" :
                                step.status === 'loading' ? "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 animate-pulse" :
                                "bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800"
                            )}>
                                <div className={clsx(
                                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                                    step.status === 'success' ? "bg-emerald-500 text-white" :
                                    step.status === 'error' ? "bg-rose-500 text-white" :
                                    step.status === 'loading' ? "bg-blue-500 text-white" :
                                    "bg-gray-200 dark:bg-slate-700 text-gray-400"
                                )}>
                                    {step.status === 'success' ? '✓' : step.status === 'error' ? '!' : idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                        "text-sm font-bold",
                                        step.status === 'success' ? "text-emerald-700 dark:text-emerald-400" :
                                        step.status === 'error' ? "text-rose-700 dark:text-rose-400" :
                                        "text-gray-700 dark:text-gray-300"
                                    )}>{step.title}</p>
                                    {step.msg && <p className="text-[10px] text-gray-500 mt-0.5 break-words">{step.msg}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Console Output */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Terminal size={12} /> Saída do Sistema
                            </span>
                            <button onClick={copyLogs} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                                <Copy size={12} /> Copiar Logs
                            </button>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-300 space-y-1 overflow-x-auto max-h-[200px]">
                            {logs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 border-b border-slate-800 pb-1 last:border-0">
                                    <span className="text-slate-500 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                                    <span className="break-all">{log}</span>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-slate-500 italic">Nenhum log gerado ainda...</p>}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="h-9 px-4 text-xs font-bold text-gray-500">
                        Fechar
                    </Button>
                    {action?.visible && (
                        <Button 
                            onClick={action.onClick}
                            className={clsx(
                                "h-9 px-4 text-xs font-bold shadow-sm",
                                action.variant === 'warning' ? "bg-amber-600 hover:bg-amber-700" :
                                action.variant === 'success' ? "bg-emerald-600 hover:bg-emerald-700" :
                                "bg-indigo-600 hover:bg-indigo-700"
                            )}
                        >
                            {action.label}
                            <ChevronRight size={14} className="ml-1" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
