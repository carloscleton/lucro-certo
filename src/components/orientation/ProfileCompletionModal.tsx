import { useState } from 'react';
import { User, Phone, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPhoneInput } from '../../utils/phoneUtils';

interface ProfileCompletionModalProps {
    userId: string;
    onComplete: () => void;
}

export function ProfileCompletionModal({ userId, onComplete }: ProfileCompletionModalProps) {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanPhone = phone.replace(/\D/g, '');
        if (fullName.trim().split(' ').length < 2) {
            setError('Por favor, informe seu nome completo (nome e sobrenome).');
            return;
        }
        if (cleanPhone.length < 10) {
            setError('Por favor, informe um telefone válido com DDD.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    phone: cleanPhone,
                    status: 'active'
                })
                .eq('id', userId);

            if (updateError) throw updateError;
            
            onComplete();
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError('Erro ao salvar dados. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700/50 transform animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <User size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
                            <Sparkles className="text-white fill-white" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Quase lá! ✨</h2>
                        <p className="text-blue-100/90 leading-relaxed">
                            Precisamos de alguns dados básicos para personalizar sua experiência e garantir a segurança da sua conta.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium flex items-start gap-3">
                            <span className="shrink-0 text-lg">⚠️</span>
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                                Nome Completo
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Ex: Carlos Silva"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                                Telefone / WhatsApp
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                                    placeholder="(00) 00000-0000"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <Save size={20} className="group-hover:translate-x-0.5 transition-transform" />
                                <span>Salvar e Continuar</span>
                            </>
                        )}
                    </button>
                    
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400 px-4">
                        Seus dados estão seguros e seguem nossas políticas de privacidade.
                    </p>
                </form>
            </div>
        </div>
    );
}

function Sparkles(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M19 17v4" />
            <path d="M3 5h4" />
            <path d="M17 19h4" />
        </svg>
    );
}
