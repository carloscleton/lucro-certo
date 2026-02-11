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
                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-magenta-500 p-6 relative" style={{ background: 'linear-gradient(90deg, #9333ea 0%, #d946ef 100%)' }}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/10 shadow-lg">
                            <Icon className="text-white" size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
                            {subtitle && (
                                <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 bg-white dark:bg-slate-800 transition-colors">
                    {children}
                </div>
            </div>
        </div>
    );
}
