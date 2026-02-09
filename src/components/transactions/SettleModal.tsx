import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface SettleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number) => Promise<void>;
    transactionType: 'expense' | 'income';
    transactionAmount: number;
    transactionDescription: string;
    transactionDueDate: string;
}

export function SettleModal({ isOpen, onClose, onConfirm, transactionType, transactionAmount, transactionDescription, transactionDueDate }: SettleModalProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [interest, setInterest] = useState('');
    const [penalty, setPenalty] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    // Check if payment date is after due date
    const isLate = date > transactionDueDate;

    const interestValue = parseFloat(interest) || 0;
    const penaltyValue = parseFloat(penalty) || 0;
    const totalAmount = transactionAmount + interestValue + penaltyValue;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onConfirm(date, paymentMethod, interestValue, penaltyValue, totalAmount);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 relative transition-colors">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <X size={24} />
                </button>

                <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
                    Confirmar {transactionType === 'expense' ? 'Pagamento' : 'Recebimento'}
                </h2>
                <div className="mb-6 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{transactionDescription}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                    </p>
                    {(interestValue > 0 || penaltyValue > 0) && (
                        <p className="text-xs text-gray-400 mt-1">
                            (Original: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transactionAmount)} + Juros/Multa)
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label={transactionType === 'expense' ? 'Data do Pagamento' : 'Data do Recebimento'}
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                    />

                    {isLate && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Input
                                label="Juros (R$)"
                                type="number"
                                step="0.01"
                                value={interest}
                                onChange={e => setInterest(e.target.value)}
                                placeholder="0,00"
                            />
                            <Input
                                label="Multa (R$)"
                                type="number"
                                step="0.01"
                                value={penalty}
                                onChange={e => setPenalty(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Forma de Pagamento
                        </label>
                        <select
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-blue-400"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                        >
                            <option value="">Outros</option>
                            <option value="pix">Pix</option>
                            <option value="credit_card">Cartão de Crédito</option>
                            <option value="debit_card">Cartão de Débito</option>
                            <option value="boleto">Boleto</option>
                            <option value="cash">Dinheiro</option>
                            <option value="transfer">Transferência</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" isLoading={loading}>
                            Confirmar
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
