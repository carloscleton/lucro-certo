import React from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon: LucideIcon;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    children,
    maxWidth = 'max-w-md'
}: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={clsx(
                    'w-full bg-[var(--color-surface)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200',
                    maxWidth
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header com Gradiente */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Icon className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{title}</h2>
                            {subtitle && (
                                <p className="text-purple-100 text-sm">{subtitle}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
