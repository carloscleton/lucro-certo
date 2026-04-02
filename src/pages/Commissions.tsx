import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { format } from 'date-fns';
import { Printer, Filter, DollarSign, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEntity } from '../context/EntityContext';
import { useAdmin } from '../hooks/useAdmin';

interface CommissionTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    paid_amount?: number;
    origin: string;
    commission_value: number;
    payment_method?: string;
    status: 'received' | 'pending';
}

export function Commissions() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { settings, loading: settingsLoading } = useSettings();

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(1); // First day of current month
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const date = new Date();
        // date.setMonth(date.getMonth() + 1); // Next month? No, default to current month view usually.
        // Let's default to end of current month to see potentials? Or just today?
        // Let's keep today for end date, but maybe user wants to see future.
        // Let's set to end of current month by default.
        const y = date.getFullYear();
        const m = date.getMonth();
        return new Date(y, m + 1, 0).toISOString().split('T')[0];
    });

    const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | 'all'>(currentEntity.type === 'company' ? currentEntity.id! : 'all');
    const [isMounted, setIsMounted] = useState(false);

    const { isAdmin, companiesList } = useAdmin();

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (user && !settingsLoading) {
            fetchTransactions();
        }
    }, [user, settings, settingsLoading, startDate, endDate, currentEntity, selectedCompanyId]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('*, contact:contacts(name)')
                .eq('type', 'income')
                .in('status', ['received', 'pending', 'late']) // Fetch received and pending
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            if (isAdmin) {
                if (selectedCompanyId === 'personal') {
                    query = query.eq('user_id', user!.id).is('company_id', null);
                } else if (selectedCompanyId !== 'all') {
                    query = query.eq('company_id', selectedCompanyId);
                }
                // If 'all', we don't add company_id filter to show everything
            } else if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user!.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                // Formatting data based on role and selection
                const formattedData = data.map(t => {
                    let rateToUse = (settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0);

                    // If Admin is viewing all companies, we need the platform commission rate for EACH company
                    if (isAdmin && t.company_id && selectedCompanyId === 'all') {
                        const companyDetails = companiesList.find((c: any) => c.id === t.company_id);
                        const s = companyDetails?.settings || {};
                        rateToUse = (s.service_commission_rate || 0) + (s.product_commission_rate || 0) + (s.commission_rate || 0);
                    } else if (isAdmin && selectedCompanyId !== 'personal' && selectedCompanyId !== 'all') {
                        const companyDetails = companiesList.find((c: any) => c.id === selectedCompanyId);
                        const s = companyDetails?.settings || {};
                        rateToUse = (s.service_commission_rate || 0) + (s.product_commission_rate || 0) + (s.commission_rate || 0);
                    }

                    const baseAmount = t.status === 'received' && t.paid_amount ? Number(t.paid_amount) : Number(t.amount);
                    return {
                        id: t.id,
                        date: t.date,
                        description: t.description,
                        amount: Number(t.amount),
                        paid_amount: t.paid_amount ? Number(t.paid_amount) : undefined,
                        origin: t.contact?.name || t.origin || 'N/A',
                        commission_value: baseAmount * (rateToUse / 100),
                        payment_method: t.payment_method,
                        status: t.status === 'received' ? 'received' : 'pending'
                    };
                });
                // @ts-ignore
                setTransactions(formattedData);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Calculate totals
    const totalReceivedAmount = transactions
        .filter(t => t.status === 'received')
        .reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);

    const totalReceivedCommission = transactions
        .filter(t => t.status === 'received')
        .reduce((acc, t) => acc + t.commission_value, 0);

    const totalPendingCommission = transactions
        .filter(t => t.status === 'pending')
        .reduce((acc, t) => acc + t.commission_value, 0);

    // Chart data - group by day
    // Chart data - group by day
    const chartData = useMemo(() => {
        const grouped = transactions.reduce((acc, t) => {
            const dateKey = format(new Date(t.date), 'dd/MM');
            if (!acc[dateKey]) {
                acc[dateKey] = { date: dateKey, comissao: 0, previsao: 0 };
            }
            if (t.status === 'received') {
                acc[dateKey].comissao += t.commission_value;
            } else {
                acc[dateKey].previsao += t.commission_value;
            }
            return acc;
        }, {} as Record<string, { date: string, comissao: number, previsao: number }>);

        return Object.values(grouped);
    }, [transactions]);

    if (!user) return null;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20 print:p-0 print:max-w-none">
            {/* Header - Hidden on Print */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="text-green-600" />
                        {t('commissions.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {isAdmin && selectedCompanyId !== 'all'
                            ? `${t('commissions.company_view')} (${(() => {
                                if (selectedCompanyId === 'personal') return (settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0);
                                const companyDetails = companiesList.find((c: any) => c.id === selectedCompanyId);
                                const s = companyDetails?.settings || {};
                                return (s.service_commission_rate || 0) + (s.product_commission_rate || 0) + (s.commission_rate || 0);
                            })()}%).`
                            : `${t('commissions.personal_view')} (${(settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0)}%).`
                        }
                    </p>
                </div>
            </div>

            {/* Filters - Hidden on Print */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4 print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    <Input
                        label={t('commissions.start_date')}
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        containerClassName="md:w-48"
                    />
                    <Input
                        label={t('commissions.end_date')}
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        containerClassName="md:w-48"
                    />

                    {isAdmin && (
                        <div className="flex flex-col gap-1 w-full md:w-auto">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('commissions.company_filter')}</label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="h-10 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:min-w-[200px]"
                            >
                                <option value="all">{t('commissions.all_companies')}</option>
                                <option value="personal">{t('commissions.personal_only')}</option>
                                {companiesList.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.trade_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="pb-1 flex gap-2 ml-auto">
                        <Button onClick={fetchTransactions} isLoading={loading}>
                            <Filter size={18} className="mr-2" />
                            {t('commissions.update')}
                        </Button>
                        <Button onClick={handlePrint} variant="outline">
                            <Printer size={18} className="mr-2" />
                            {t('commissions.generate_receipt')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Header - Visible only on Print - FORMAL RECEIPT HEADER */}
            <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-black mb-1">{t('commissions.receipt_title')}</h1>
                        <p className="text-sm text-gray-600">{t('commissions.period')}: {format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{currentEntity.type === 'company' ? 'EMPRESA' : user.email}</p>
                        <p className="text-sm text-gray-500">{t('commissions.issue_date')}: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Hidden on print? Maybe allow summary on print. */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-indigo-500 print:shadow-none print:border">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('settings.commission_rate')}</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {(() => {
                            if (selectedCompanyId === 'all') return '--';
                            if (selectedCompanyId === 'personal') return `${((settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;
                            const companyDetails = companiesList.find((c: any) => c.id === selectedCompanyId);
                            const s = companyDetails?.settings || {};
                            return `${((s.service_commission_rate || 0) + (s.product_commission_rate || 0) + (s.commission_rate || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;
                        })()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Percentual configurado</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-green-500 print:shadow-none print:border">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('commissions.received_commissions')}</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalReceivedCommission)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{t('commissions.available_withdrawal')}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-yellow-500 print:shadow-none print:border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('commissions.future_commissions')}</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalPendingCommission)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{t('commissions.earnings_estimate')}</p>
                        </div>
                        <Clock className="text-yellow-500 opacity-50" size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-blue-500 print:shadow-none print:border">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('commissions.total_sales')}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalReceivedAmount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{t('commissions.calculation_base')}</p>
                </div>
            </div>

            {/* Chart - Hidden on Print to keep receipt clean */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 print:hidden">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('commissions.period_evolution')}</h3>
                <div className="relative min-h-[256px] w-full min-w-0 overflow-hidden">
                    {isMounted && (
                        <div className="absolute inset-0 w-full h-full">
                            <ResponsiveContainer key="chart-comm" width="99.9%" height="100%" minWidth={0} minHeight={0} debounce={200}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickFormatter={(value) => `R$ ${value}`} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value: any) => new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value)} />
                                    <Bar dataKey="comissao" fill="#16a34a" name="Recebido" stackId="a" />
                                    <Bar dataKey="previsao" fill="#eab308" name="Pendente" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {!isMounted && (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="animate-pulse text-gray-400">Carregando gráfico...</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden print:shadow-none print:border-gray-200 print:mt-4">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 print:bg-gray-100">
                    <h3 className="font-medium text-gray-900 dark:text-white">{t('commissions.entries_detail')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t('common.date')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t('commissions.origin')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">{t('commissions.sale_value')}</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">{t('commissions.commission')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        {t('commissions.no_commissions')}
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-3 text-gray-900 dark:text-white">
                                            {format(new Date(tx.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-3 text-gray-900 dark:text-white">
                                            {tx.origin}<br />
                                            <span className="text-xs text-gray-500">
                                                {tx.description}
                                                {tx.paid_amount && tx.paid_amount !== tx.amount && (
                                                    <span className="ml-1 text-blue-500">{t('commissions.inc_fees')}</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.status === 'received'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                {tx.status === 'received' ? t('transactions.paid') : t('common.pending')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(tx.paid_amount || tx.amount)}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-bold ${tx.status === 'received' ? 'text-green-600' : 'text-yellow-600'
                                            }`}>
                                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(tx.commission_value)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-slate-700/50 font-bold border-t-2 border-gray-300">
                            <tr>
                                <td colSpan={3} className="px-6 py-3 text-right text-gray-900 dark:text-white uppercase tracking-wider">{t('commissions.total_paid')}</td>
                                <td colSpan={2} className="px-6 py-3 text-right text-green-600 dark:text-green-400 text-lg">
                                    {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(totalReceivedCommission)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Signature Section - Print Only */}
            <div className="hidden print:block mt-20 pt-8">
                <div className="grid grid-cols-2 gap-20">
                    <div className="text-center">
                        <div className="border-t border-black pt-2">
                            {t('commissions.payer_signature')}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-black pt-2">
                            {t('commissions.receiver_signature')} ({user.email})
                        </div>
                    </div>
                </div>
                <div className="mt-8 text-center text-xs text-gray-400">
                    {t('commissions.generated_by')}
                </div>
            </div>
        </div>
    );
}
