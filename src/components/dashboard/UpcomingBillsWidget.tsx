import { AlertCircle, Calendar, CheckCircle2, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { useState } from 'react';
import { useUpcomingBills } from '../../hooks/useUpcomingBills';
import { useTransactions } from '../../hooks/useTransactions';
import { Tooltip } from '../ui/Tooltip';
import type { UpcomingBill } from '../../hooks/useUpcomingBills';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface UpcomingBillsWidgetProps {
    onRefreshMetrics?: () => void;
}

export function UpcomingBillsWidget({ onRefreshMetrics }: UpcomingBillsWidgetProps) {
    const { bills, loading, refresh } = useUpcomingBills(30);
    const { updateTransaction } = useTransactions('expense');
    const { updateTransaction: updateIncome } = useTransactions('income');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<UpcomingBill | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('Outros');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [interest, setInterest] = useState<string>('');
    const [penalty, setPenalty] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOpenModal = (bill: UpcomingBill) => {
        setSelectedBill(bill);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod(bill.payment_method || 'Outros');
        setInterest('');
        setPenalty('');
        setIsModalOpen(true);
    };

    const handleConfirmPayment = async () => {
        if (!selectedBill) return;

        setIsSubmitting(true);
        try {
            const newStatus: 'paid' | 'received' = selectedBill.type === 'expense' ? 'paid' : 'received';

            const interestValue = parseFloat(interest) || 0;
            const penaltyValue = parseFloat(penalty) || 0;
            const totalPaid = Number(selectedBill.amount) + interestValue + penaltyValue;

            const updates = {
                status: newStatus,
                payment_method: paymentMethod,
                payment_date: paymentDate,
                interest: interestValue,
                penalty: penaltyValue,
                paid_amount: totalPaid
            };

            if (selectedBill.type === 'expense') {
                await updateTransaction(selectedBill.id, updates);
            } else {
                await updateIncome(selectedBill.id, updates);
            }

            setIsModalOpen(false);
            setSelectedBill(null);
            refresh();
            if (onRefreshMetrics) onRefreshMetrics();
        } catch (error: any) {
            console.error('Error marking bill as paid:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const BillItem = ({ bill }: { bill: UpcomingBill }) => (
        <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <Tooltip content="Marcar como pago">
                    <button
                        onClick={() => handleOpenModal(bill)}
                        className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex items-center justify-center group-hover:scale-110"
                    >
                        <CheckCircle2 className="w-3 h-3 text-transparent group-hover:text-emerald-500 transition-colors" />
                    </button>
                </Tooltip>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {formatDate(bill.date)}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {bill.description}
                        </span>
                    </div>
                </div>
            </div>
            <span className={`text-sm font-bold whitespace-nowrap ml-2 ${bill.type === 'expense'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                {bill.type === 'expense' ? '-' : '+'}{formatCurrency(bill.amount)}
            </span>
        </div>
    );

    const BillSection = ({
        title,
        bills,
        icon,
        color
    }: {
        title: string;
        bills: UpcomingBill[];
        icon: React.ReactNode;
        color: string;
    }) => {
        if (bills.length === 0) return null;

        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    {icon}
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                        {title} ({bills.length})
                    </h4>
                </div>
                <div className="space-y-1">
                    {bills.slice(0, 5).map(bill => (
                        <BillItem key={bill.id} bill={bill} />
                    ))}
                    {bills.length > 5 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                            ... mais {bills.length - 5} contas
                        </p>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                    <div className="space-y-2">
                        <div className="h-12 bg-gray-200 dark:bg-slate-700 rounded"></div>
                        <div className="h-12 bg-gray-200 dark:bg-slate-700 rounded"></div>
                        <div className="h-12 bg-gray-200 dark:bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    const totalBills = bills.overdue.length + bills.thisWeek.length + bills.upcoming.length;

    if (totalBills === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Próximas Contas
                    </h3>
                </div>
                <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Nenhuma conta pendente nos próximos 30 dias!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Próximas Contas (30 dias)
                        </h3>
                    </div>
                    {bills.overdue.length > 0 && (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">
                            {bills.overdue.length} vencida{bills.overdue.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Bills List */}
            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                <BillSection
                    title="VENCIDAS"
                    bills={bills.overdue}
                    icon={<AlertCircle className="w-4 h-4 text-red-600" />}
                    color="text-red-600 dark:text-red-400"
                />

                <BillSection
                    title="ESTA SEMANA"
                    bills={bills.thisWeek}
                    icon={<AlertCircle className="w-4 h-4 text-yellow-600" />}
                    color="text-yellow-600 dark:text-yellow-400"
                />

                <BillSection
                    title="PRÓXIMAS"
                    bills={bills.upcoming}
                    icon={<Calendar className="w-4 h-4 text-emerald-600" />}
                    color="text-emerald-600 dark:text-emerald-400"
                />
            </div>

            {/* Footer with Totals */}
            <div className="p-6 pt-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Total a Pagar
                        </span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(bills.totalExpenses)}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Total a Receber
                        </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(bills.totalIncome)}
                    </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            Saldo Previsto
                        </span>
                        <span className={`text-lg font-bold ${bills.netBalance >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                            }`}>
                            {bills.netBalance >= 0 ? '+' : ''}{formatCurrency(bills.netBalance)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Payment Confirmation Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedBill?.type === 'expense' ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
                icon={DollarSign}
                maxWidth="max-w-md"
            >
                {selectedBill && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                {selectedBill.description}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                Total: {formatCurrency(Number(selectedBill.amount) + (parseFloat(interest) || 0) + (parseFloat(penalty) || 0))}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {selectedBill.type === 'expense' ? 'Data do Pagamento' : 'Data do Recebimento'}
                                </label>
                                <Input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Juros (R$)"
                                    type="number"
                                    step="0.01"
                                    value={interest}
                                    onChange={(e) => setInterest(e.target.value)}
                                    placeholder="0,00"
                                />
                                <Input
                                    label="Multa (R$)"
                                    type="number"
                                    step="0.01"
                                    value={penalty}
                                    onChange={(e) => setPenalty(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Forma de Pagamento
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="Outros">Outros</option>
                                    <option value="pix">Pix</option>
                                    <option value="credit_card">Cartão de Crédito</option>
                                    <option value="debit_card">Cartão de Débito</option>
                                    <option value="boleto">Boleto</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="transfer">Transferência</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmPayment}
                                isLoading={isSubmitting}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all active:scale-[0.98]"
                            >
                                {selectedBill.type === 'expense' ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
