import { useState, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { useContacts } from '../../hooks/useContacts';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Tag, Building2, Repeat, Receipt } from 'lucide-react';
import { formatBrazilianDate } from '../../utils/dateUtils';

interface AnalyticalLedgerProps {
    startDate: string;
    endDate: string;
    onSelect?: (transaction: any) => void;
}

export function AnalyticalLedger({ startDate, endDate, onSelect }: AnalyticalLedgerProps) {
    const { t } = useTranslation();
    const { transactions: expenses } = useTransactions('expense');
    const { transactions: income } = useTransactions('income');
    const { categories } = useCategories();
    const { contacts } = useContacts();

    const [groupBy, setGroupBy] = useState<'category' | 'contact'>('category');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const allTransactions = useMemo(() => {
        return [...expenses, ...income].filter(tr => tr.date >= startDate && tr.date <= endDate);
    }, [expenses, income, startDate, endDate]);

    const groupedData = useMemo(() => {
        const groups: Record<string, { name: string; total: number; items: any[], type: 'income' | 'expense' | 'mixed' }> = {};

        allTransactions.forEach(tr => {
            let groupId = 'none';
            let groupName = t('common.none') || 'Nenhum';

            if (groupBy === 'category') {
                groupId = tr.category_id || 'none';
                groupName = categories.find(c => c.id === tr.category_id)?.name || t('reports.no_category');
            } else {
                groupId = tr.contact_id || 'none';
                groupName = contacts.find(c => c.id === tr.contact_id)?.name || (tr.type === 'expense' ? t('reports.no_supplier') : t('reports.no_client')) || 'Sem Contato';
            }

            if (!groups[groupId]) {
                groups[groupId] = { name: groupName, total: 0, items: [], type: tr.type };
            } else if (groups[groupId].type !== tr.type) {
                groups[groupId].type = 'mixed';
            }

            const amount = tr.type === 'expense' ? -tr.amount : tr.amount;
            groups[groupId].total += amount;
            groups[groupId].items.push(tr);
        });

        // Sort by absolute total value
        return Object.entries(groups).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
    }, [allTransactions, groupBy, categories, contacts, t]);

    const toggleGroup = (id: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedGroups(newSet);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-slate-800/50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-emerald-600" />
                        Razão Analítico de Contas
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Detalhamento de movimentações agrupadas</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                    <button
                        onClick={() => setGroupBy('category')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${groupBy === 'category' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <Tag className="w-3.5 h-3.5" /> Por Categoria
                    </button>
                    <button
                        onClick={() => setGroupBy('contact')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${groupBy === 'contact' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <Building2 className="w-3.5 h-3.5" /> Por Fornecedor/Cliente
                    </button>
                </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {groupedData.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 italic">
                        Nenhum lançamento encontrado para este período.
                    </div>
                ) : (
                    groupedData.map(([id, group]) => (
                        <div key={id} className="flex flex-col">
                            <button
                                onClick={() => toggleGroup(id)}
                                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedGroups.has(id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    <div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{group.name}</span>
                                        <span className="ml-2 text-[10px] text-gray-400 font-normal">({group.items.length} lançamentos)</span>
                                    </div>
                                </div>
                                <div className={`text-sm font-black ${group.total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.total)}
                                </div>
                            </button>

                            {expandedGroups.has(id) && (
                                <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                                    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-slate-700">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400">
                                                <tr>
                                                    <th className="px-3 py-2 font-semibold">Data</th>
                                                    <th className="px-3 py-2 font-semibold">Descrição</th>
                                                    <th className="px-3 py-2 font-semibold text-center">Tipo</th>
                                                    <th className="px-3 py-2 font-semibold text-right">Valor</th>
                                                    <th className="px-3 py-2 font-semibold text-center w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                {[...group.items].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors group/row border-b border-gray-50 dark:border-slate-800 last:border-0"
                                                    >
                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {formatBrazilianDate(new Date(item.date + 'T12:00:00'))}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-gray-900 dark:text-white group-hover/row:text-emerald-600 transition-colors">{item.description}</span>
                                                                {(item.is_recurring || item.recurrence_group_id) && (
                                                                    <span className="flex items-center gap-1 text-[9px] text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                                                                        <Repeat className="w-2.5 h-2.5" />
                                                                        {item.installment_number && item.recurring_count ? `${item.installment_number}/${item.recurring_count}` : 'Recorrente'}
                                                                    </span>
                                                                )}
                                                                {item.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-label="Pendente" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {item.type === 'expense' ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[9px] font-bold uppercase">Saída</span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase">Entrada</span>
                                                            )}
                                                        </td>
                                                        <td className={`px-3 py-2 text-right font-bold ${item.type === 'expense' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center">
                                                                <button
                                                                    className="p-1 px-2 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        onSelect?.(item);
                                                                    }}
                                                                >
                                                                    VER
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-900/30 text-[10px] text-gray-400 flex justify-between items-center sm:px-6">
                <span>* Valores em vermelho indicam saídas líquidas no grupo.</span>
                <span className="flex items-center gap-1"><Repeat className="w-2.5 h-2.5" /> Indica recorrência automática</span>
            </div>
        </div>
    );
}
