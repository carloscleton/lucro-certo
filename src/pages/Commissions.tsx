import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { format } from 'date-fns';
import { Printer, Filter, DollarSign, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEntity } from '../context/EntityContext';

interface CommissionTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    origin: string;
    commission_value: number;
    payment_method?: string;
    status: 'received' | 'pending';
}

export function Commissions() {
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

    useEffect(() => {
        if (user && !settingsLoading && settings.commission_rate !== undefined) {
            fetchTransactions();
        }
    }, [user, settings, settingsLoading, startDate, endDate, currentEntity]);

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
                .order('date', { ascending: true });

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user!.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                // Sum all commission rates
                const effectiveRate = (settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0);

                const formattedData = data.map(t => ({
                    id: t.id,
                    date: t.date,
                    description: t.description,
                    amount: Number(t.amount),
                    origin: t.contact?.name || t.origin || 'N/A',
                    commission_value: Number(t.amount) * (effectiveRate / 100),
                    payment_method: t.payment_method,
                    status: t.status === 'received' ? 'received' : 'pending' // normalize late to pending for comm view
                }));
                // @ts-ignore - status match
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
        .reduce((acc, t) => acc + t.amount, 0);

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
                        Comissões e Resultados
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Gestão de recebíveis e cálculo de comissões ({(settings.service_commission_rate || 0) + (settings.product_commission_rate || 0) + (settings.commission_rate || 0)}%).
                    </p>
                </div>
                <Button onClick={handlePrint} variant="outline">
                    <Printer size={18} className="mr-2" />
                    Gerar Recibo / PDF
                </Button>
            </div>

            {/* Filters - Hidden on Print */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4 print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    <Input
                        label="Data Inicial"
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                    <Input
                        label="Data Final"
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                    <div className="pb-1">
                        <Button onClick={fetchTransactions} isLoading={loading}>
                            <Filter size={18} className="mr-2" />
                            Atualizar
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Header - Visible only on Print - FORMAL RECEIPT HEADER */}
            <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-black mb-1">Demonstrativo de Comissões</h1>
                        <p className="text-sm text-gray-600">Período de Apuração: {format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{currentEntity.type === 'company' ? 'EMPRESA' : user.email}</p>
                        <p className="text-sm text-gray-500">Data de Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Hidden on print? Maybe allow summary on print. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-green-500 print:shadow-none print:border">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Comissões Recebidas</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivedCommission)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Disponível para saque</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-yellow-500 print:shadow-none print:border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">À Receber / Futuro</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingCommission)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Estimativa de ganhos</p>
                        </div>
                        <Clock className="text-yellow-500 opacity-50" size={24} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-blue-500 print:shadow-none print:border">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Vendas Totais (Período)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivedAmount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Base de cálculo (Realizado)</p>
                </div>
            </div>

            {/* Chart - Hidden on Print to keep receipt clean */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 print:hidden">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Evolução do Período</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickFormatter={(value) => `R$ ${value}`} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                            <Bar dataKey="comissao" fill="#16a34a" name="Recebido" stackId="a" />
                            <Bar dataKey="previsao" fill="#eab308" name="Pendente" stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden print:shadow-none print:border-gray-200 print:mt-4">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 print:bg-gray-100">
                    <h3 className="font-medium text-gray-900 dark:text-white">Detalhamento dos Lançamentos</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Data</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Origem</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Valor Venda</th>
                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Comissão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Nenhuma comissão encontrada.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-3 text-gray-900 dark:text-white">
                                            {format(new Date(t.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-3 text-gray-900 dark:text-white">
                                            {t.origin}<br />
                                            <span className="text-xs text-gray-500">{t.description}</span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === 'received'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                {t.status === 'received' ? 'Pago' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-bold ${t.status === 'received' ? 'text-green-600' : 'text-yellow-600'
                                            }`}>
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.commission_value)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-slate-700/50 font-bold border-t-2 border-gray-300">
                            <tr>
                                <td colSpan={3} className="px-6 py-3 text-right text-gray-900 dark:text-white uppercase tracking-wider">Total Pago:</td>
                                <td colSpan={2} className="px-6 py-3 text-right text-green-600 dark:text-green-400 text-lg">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivedCommission)}
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
                            Assinatura do Pagador (Empresa)
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-black pt-2">
                            Assinatura do Recebedor ({user.email})
                        </div>
                    </div>
                </div>
                <div className="mt-8 text-center text-xs text-gray-400">
                    Documento gerado eletronicamente em {new Date().toLocaleString('pt-BR')} pelo sistema Lucro Certo.
                </div>
            </div>
        </div>
    );
}
