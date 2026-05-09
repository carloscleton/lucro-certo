import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    isLoading?: boolean;
}

export function ConfirmationModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmLabel = 'Confirmar', 
    cancelLabel = 'Cancelar',
    variant = 'primary',
    isLoading = false
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    const icons = {
        primary: <HelpCircle size={24} className="text-blue-600 dark:text-blue-400" />,
        warning: <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />,
        danger: <AlertTriangle size={24} className="text-rose-600 dark:text-rose-400" />
    };

    const bgColors = {
        primary: 'bg-blue-100 dark:bg-blue-900/30',
        warning: 'bg-amber-100 dark:bg-amber-900/30',
        danger: 'bg-rose-100 dark:bg-rose-900/30'
    };

    const buttonVariants = {
        primary: 'bg-blue-600 hover:bg-blue-700',
        warning: 'bg-amber-600 hover:bg-amber-700',
        danger: 'bg-rose-600 hover:bg-rose-700'
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="p-8 text-center">
                    <div className="flex justify-center mb-6">
                        <div className={clsx("p-4 rounded-2xl", bgColors[variant])}>
                            {icons[variant]}
                        </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                        {message}
                    </p>

                    <div className="flex flex-col gap-2">
                        <Button 
                            onClick={onConfirm} 
                            isLoading={isLoading}
                            className={clsx("w-full h-12 rounded-xl text-sm font-bold shadow-lg", buttonVariants[variant])}
                        >
                            {confirmLabel}
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            disabled={isLoading}
                            className="w-full h-12 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                            {cancelLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
