import { CalendarClock, AlertCircle } from 'lucide-react';
import { formatDateString } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

interface PendingListProps {
    transactions: any[];
}

export function PendingList({ transactions }: PendingListProps) {
    const { t } = useTranslation();

    if (transactions.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('dashboard.pending_bills_month')}</h3>
            <div className="space-y-3">
                {transactions.map(tItem => {
                    const today = new Date().toISOString().split('T')[0];
                    const isOverdue = tItem.date < today;
                    return (
                        <div key={tItem.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                    {isOverdue ? <AlertCircle size={18} /> : <CalendarClock size={18} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 dark:text-white">{tItem.description}</p>
                                        {tItem.category?.name && (
                                            <span className="text-[10px] bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-sm">
                                                {tItem.category.name}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {t('dashboard.due_label')} {formatDateString(tItem.date)}
                                    </p>
                                </div>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(tItem.amount)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
