import { Edit2, Trash2, CheckCircle, Paperclip, Download, FileText, Repeat, TrendingUp } from 'lucide-react';
import type { Transaction } from '../../hooks/useTransactions';
import { Tooltip } from '../ui/Tooltip';

import { useTeam } from '../../hooks/useTeam';


interface TransactionListProps {
    transactions: Transaction[];
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (t: Transaction) => void;
    canDelete?: boolean;
    onViewQuote?: (quoteId: string) => void;
}

export function TransactionList({ transactions, onEdit, onDelete, onToggleStatus, canDelete = true, onViewQuote }: TransactionListProps) {
    const { members } = useTeam();

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatDate = (dateStr: string | null | undefined) =>
        dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

    const getUserName = (userId: string) => {
        const member = members.find(m => m.user_id === userId);
        return member?.profile.full_name.split(' ')[0] || '-';
    };

    if (transactions.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Nenhum lançamento encontrado.
            </div>
        );
    }

    const handleExport = () => {
        if (transactions.length === 0) return;

        const headers = ['Descrição', 'Responsável', 'Data', 'Valor', 'Tipo', 'Status', 'Nota/Anexo'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(t => {
                const amount = t.amount.toString().replace('.', ',');
                const status = t.status === 'pending' ? 'Pendente' :
                    t.status === 'late' ? 'Atrasado' :
                        t.type === 'expense' ? 'Pago' : 'Recebido';
                return [
                    `"${t.description}"`,
                    `"${getUserName(t.user_id)}"`,
                    new Date(t.date).toLocaleDateString('pt-BR'),
                    `"${amount}"`,
                    t.type === 'expense' ? 'Despesa' : 'Receita',
                    status,
                    t.attachment_url ? `"${t.attachment_url}"` : ''
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'transacoes.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Lançamentos</h3>
                <Tooltip content="Exportar para CSV">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors"
                    >
                        <Download size={16} />
                        Exportar
                    </button>
                </Tooltip>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-slate-700">
                        <tr>
                            <th className="px-3 py-3 w-[25%]">Descrição</th>
                            <th className="px-3 py-3 w-[10%]">Resp.</th>
                            <th className="px-3 py-3 w-[12%]">Vencimento</th>
                            <th className="px-3 py-3 w-[12%]">Pagamento</th>
                            <th className="px-3 py-3 w-[15%]">Forma Pgto</th>
                            <th className="px-3 py-3 w-[12%]">Valor</th>
                            <th className="px-3 py-3 w-[10%]">Status</th>
                            <th className="px-3 py-3 w-[4%] text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {transactions.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-3 py-3 font-medium text-gray-900 dark:text-white truncate max-w-[120px] lg:max-w-[250px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Tooltip content={t.description}>
                                            <span className="truncate">{t.description}</span>
                                        </Tooltip>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {t.is_recurring && (
                                                <Tooltip content={`Recorrente (${{ weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' }[t.frequency || 'monthly']}) ${t.installment_number ? `- Part #${t.installment_number}` : ''}`}>
                                                    <Repeat size={11} className="text-emerald-500" />
                                                </Tooltip>
                                            )}
                                            {t.is_variable_amount && (
                                                <Tooltip content="Valor Variável (Estimado)">
                                                    <TrendingUp size={11} className="text-blue-500" />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                                    {getUserName(t.user_id)}
                                </td>
                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-[11px] whitespace-nowrap">
                                    {t.status === 'pending' || t.status === 'late' ? '-' : formatDate(t.payment_date || t.date)}
                                </td>
                                <td className="px-3 py-3 text-[11px] whitespace-nowrap">
                                    {t.payment_method ? (
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${{
                                            'pix': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
                                            'credit_card': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
                                            'debit_card': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
                                            'boleto': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
                                            'cash': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
                                            'transfer': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                        }[t.payment_method] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                            }`}>
                                            {
                                                {
                                                    'pix': 'Pix',
                                                    'credit_card': 'Cartão Crédito',
                                                    'debit_card': 'Cartão Débito',
                                                    'boleto': 'Boleto',
                                                    'cash': 'Dinheiro',
                                                    'transfer': 'Transferência'
                                                }[t.payment_method] || t.payment_method
                                            }
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-600">-</span>
                                    )}
                                </td>
                                <td className={`px-3 py-3 font-bold text-xs ${t.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                    }`}>
                                    <div className="flex flex-col whitespace-nowrap">
                                        <span className={t.is_variable_amount && t.status === 'pending' ? 'text-blue-600 dark:text-blue-400 italic' : ''}>
                                            {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.paid_amount || t.amount)}
                                            {t.is_variable_amount && t.status === 'pending' && <span className="ml-1 text-[10px] font-normal">(est.)</span>}
                                        </span>
                                        {((t.interest || 0) > 0 || (t.penalty || 0) > 0) && (
                                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                                                (Orig: {formatCurrency(t.amount)}
                                                {(t.interest || 0) > 0 && ` + J: ${formatCurrency(t.interest || 0)}`}
                                                {(t.penalty || 0) > 0 && ` + M: ${formatCurrency(t.penalty || 0)}`}
                                                )
                                            </span>
                                        )}
                                    </div>
                                    {t.attachment_url && (
                                        <Tooltip content="Ver anexo">
                                            <a
                                                href={t.attachment_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 inline-flex text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                                            >
                                                <Paperclip size={14} />
                                            </a>
                                        </Tooltip>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === 'pending'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                        : t.status === 'late'
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                        }`}>
                                        {t.status === 'pending' ? 'Pendente' :
                                            t.status === 'late' ? 'Atrasado' :
                                                t.type === 'expense' ? 'Pago' : 'Recebido'}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                    <div className="flex justify-end gap-1.5 min-w-max">
                                        <Tooltip content={t.status === 'pending' ? "Marcar como pago/recebido" : "Marcar como pendente"}>
                                            <button
                                                onClick={() => onToggleStatus(t)}
                                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${t.status === 'pending' ? 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400' : 'text-green-600 dark:text-green-400'
                                                    }`}
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                        </Tooltip>

                                        {t.quote_id && onViewQuote && (
                                            <Tooltip content="Ver Orçamento (PDF)">
                                                <button
                                                    onClick={() => onViewQuote(t.quote_id!)}
                                                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                            </Tooltip>
                                        )}

                                        <Tooltip content="Editar">
                                            <button
                                                onClick={() => onEdit(t)}
                                                className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </Tooltip>
                                        {canDelete && (
                                            <Tooltip content="Excluir">
                                                <button
                                                    onClick={() => onDelete(t.id)}
                                                    className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
