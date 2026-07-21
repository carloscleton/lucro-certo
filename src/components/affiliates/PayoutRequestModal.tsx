import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DollarSign, Wallet, CheckCircle2, AlertCircle, QrCode } from 'lucide-react';

interface PayoutRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableBalance: number;
    currentPixKey?: string;
    currentPixType?: string;
    onRequestPayout: (amount: number, pixKey: string, method: 'pix' | 'invoice_discount') => Promise<{ success: boolean; message: string }>;
}

export function PayoutRequestModal({
    isOpen,
    onClose,
    availableBalance,
    currentPixKey = '',
    currentPixType = 'cpf',
    onRequestPayout
}: PayoutRequestModalProps) {
    const [amount, setAmount] = useState<number>(availableBalance);
    const [pixKey, setPixKey] = useState<string>(currentPixKey);
    const [pixType, setPixType] = useState<string>(currentPixType);
    const [method, setMethod] = useState<'pix' | 'invoice_discount'>('pix');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResult(null);

        if (amount <= 0) {
            setResult({ success: false, message: 'Digite um valor válido para solicitar o saque.' });
            return;
        }

        if (amount > availableBalance) {
            setResult({ success: false, message: 'O valor do saque não pode ser maior que seu saldo disponível.' });
            return;
        }

        if (method === 'pix' && !pixKey.trim()) {
            setResult({ success: false, message: 'Informe sua chave PIX para receber a transferência.' });
            return;
        }

        try {
            setLoading(true);
            const res = await onRequestPayout(amount, pixKey, method);
            setResult(res);
            if (res.success) {
                setTimeout(() => {
                    onClose();
                    setResult(null);
                }, 2000);
            }
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'Falha ao processar solicitação.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Resgate de Comissões" icon={Wallet}>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Saldo Disponível para Saque</span>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(availableBalance)}
                        </div>
                    </div>
                    <Wallet size={32} className="text-emerald-500 opacity-80" />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Modalidade de Resgate</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setMethod('pix')}
                            className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                                method === 'pix'
                                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            <QrCode size={18} />
                            Transferência PIX
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('invoice_discount')}
                            className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                                method === 'invoice_discount'
                                    ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            <DollarSign size={18} />
                            Abater na minha Mensalidade
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Valor a Resgatar (R$)</label>
                    <CurrencyInput
                        value={amount}
                        onChange={setAmount}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-gray-900 dark:text-white"
                    />
                </div>

                {method === 'pix' && (
                    <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-3 gap-2">
                            {['cpf', 'cnpj', 'email', 'phone', 'random'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setPixType(t)}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg border uppercase transition-all ${
                                        pixType === t
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                                    }`}
                                >
                                    {t === 'phone' ? 'Telefone' : t === 'random' ? 'Aleatória' : t}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Sua Chave PIX</label>
                            <input
                                type="text"
                                value={pixKey}
                                onChange={e => setPixKey(e.target.value)}
                                placeholder="Digite sua chave PIX..."
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}

                {result && (
                    <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        result.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                        {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{result.message}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading || availableBalance <= 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        Confirmar Solicitação
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
