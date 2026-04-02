import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Modal } from '../ui/Modal';


interface SettleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number, baseAmount?: number) => Promise<void>;
    transactionType: 'expense' | 'income';
    transactionAmount: number;
    transactionDescription: string;
    isVariableAmount?: boolean;
}

export function SettleModal({ isOpen, onClose, onConfirm, transactionType, transactionAmount, transactionDescription, isVariableAmount }: SettleModalProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [currentAmount, setCurrentAmount] = useState(transactionAmount);
    const [interest, setInterest] = useState(0);
    const [penalty, setPenalty] = useState(0);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const baseAmountValue = currentAmount;
    const interestValue = interest;
    const penaltyValue = penalty;
    const totalAmount = baseAmountValue + interestValue + penaltyValue;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onConfirm(
                date,
                paymentMethod,
                interestValue,
                penaltyValue,
                totalAmount,
                isVariableAmount ? baseAmountValue : undefined
            );
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={transactionType === 'expense' ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
            icon={DollarSign}
            maxWidth="max-w-sm"
        >
            <div className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{transactionDescription}</p>

                    {isVariableAmount ? (
                        <div className="mt-2">
                            <CurrencyInput
                                label="Valor Original (Lançamento Variável)"
                                value={currentAmount}
                                onChange={num => setCurrentAmount(num)}
                                className="font-bold text-lg"
                            />
                        </div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            Total: {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalAmount)}
                        </p>
                    )}

                    {isVariableAmount && (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-4 border-t border-gray-200 dark:border-slate-600 pt-2">
                            Total Final: {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalAmount)}
                        </p>
                    )}

                    {!isVariableAmount && (interestValue > 0 || penaltyValue > 0) && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium italic">
                            (Original: {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(transactionAmount)} + Juros/Multa)
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

                    <div className="grid grid-cols-2 gap-3">
                        <CurrencyInput
                            label={`Juros (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`}
                            value={interest}
                            onChange={num => setInterest(num)}
                            placeholder="0,00"
                        />
                        <CurrencyInput
                            label={`Multa (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})`}
                            value={penalty}
                            onChange={num => setPenalty(num)}
                            placeholder="0,00"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Forma de Pagamento
                        </label>
                        <select
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
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

                    <div className="flex justify-end gap-3 mt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" isLoading={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
                            Confirmar
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
