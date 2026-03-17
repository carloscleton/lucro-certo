import { useDashboard } from '../hooks/useDashboard';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../components/ui/Tooltip';
import { DashboardCards } from '../components/dashboard/DashboardCards';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { Alerts } from '../components/dashboard/Alerts';
import { BudgetProgress } from '../components/dashboard/BudgetProgress';
import { PendingList } from '../components/dashboard/PendingList';
import { UpcomingBillsWidget } from '../components/dashboard/UpcomingBillsWidget';
import { ExpenseByCategoryChart } from '../components/dashboard/ExpenseByCategoryChart';
import { CashFlowForecast } from '../components/dashboard/CashFlowForecast';
import { MonthlyComparison } from '../components/dashboard/MonthlyComparison';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetailModal } from '../components/dashboard/TransactionDetailModal';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { CRMStatsWidget } from '../components/dashboard/CRMStatsWidget';
import { ContextSummaryWidget } from '../components/dashboard/ContextSummaryWidget';
import { useTransactions } from '../hooks/useTransactions';
import { supabase } from '../lib/supabase';

export function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { deleteTransaction: deleteExpense } = useTransactions('expense');
    const { deleteTransaction: deleteIncome } = useTransactions('income');

    const handleDelete = async (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;

        let scope: 'single' | 'future' | 'all' = 'single';

        if (transaction.recurrence_group_id) {
            const choice = window.prompt(
                'Lançamento Recorrente detectado. O que deseja apagar?\n\n' +
                '1 - APENAS este Lançamento\n' +
                '2 - Este e os FUTUROS (A partir desta data)\n' +
                '3 - TODOS (Histórico completo desta repetição)\n\n' +
                'Digite o número da opção desejada:'
            );

            if (choice === null) return; // Cancelled

            if (choice === '2') {
                scope = 'future';
            } else if (choice === '3') {
                scope = 'all';
            } else if (choice !== '1') {
                alert('Opção inválida. Operação cancelada.');
                return;
            }
        } else {
            if (!confirm(t('common.confirm_delete'))) {
                return;
            }
        }

        try {
            if (transaction.type === 'expense') {
                await deleteExpense(id, scope);
            } else {
                await deleteIncome(id, scope);
            }
            refreshDashboard();
        } catch (error: any) {
            alert(error.message || t('common.delete_error'));
        }
    };

    // Initial State: Current Month
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Calculate start/end dates from month string
    const getMonthRange = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        const start = `${monthStr}-01`;
        const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month is last day of this month
        const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
        return { start, end };
    };

    const initialRange = getMonthRange(new Date().toISOString().slice(0, 7));
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMonthFilter(value);
        if (value) {
            const { start, end } = getMonthRange(value);
            setStartDate(start);
            setEndDate(end);
        }
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
        setMonthFilter(''); // Clear month selection if manual date is picked
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value);
        setMonthFilter(''); // Clear month selection if manual date is picked
    };

    const { metrics, chartData, alerts, expensesByCategory, pendingList, transactions, contextMetrics, previousPeriod, loading, refresh: refreshDashboard } = useDashboard(startDate, endDate);
    const { categories, loading: categoriesLoading } = useCategories();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();

    // Trial Calculation
    const isTrial = currentEntity?.subscription_plan === 'trial';
    const trialDaysLeft = (currentEntity as any)?.trial_ends_at 
        ? Math.ceil((new Date((currentEntity as any).trial_ends_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
        : 0;

    const [loadingCheckout, setLoadingCheckout] = useState(false);

    // CPF Modal state
    const [cpfModalOpen, setCpfModalOpen] = useState(false);
    const [cpfInput, setCpfInput] = useState('');
    const [cpfError, setCpfError] = useState('');
    const [pendingCheckoutCompanyId, setPendingCheckoutCompanyId] = useState<string | null>(null);

    // Core checkout executor (called after we have a valid company + CPF)
    const executeCheckout = async (companyId: string) => {
        try {
            setLoadingCheckout(true);
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-checkout`;
            const fetchRes = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ company_id: companyId, access_token: freshSession?.access_token })
            });
            const data = await fetchRes.json();
            if (fetchRes.ok && data?.paymentUrl) {
                window.open(data.paymentUrl, '_blank');
            } else {
                console.error('Checkout Error:', data);
                alert('Erro ao gerar link de pagamento: ' + (data.error || 'Erro desconhecido.'));
            }
        } catch (err: any) {
            alert('Falha ao processar checkout: ' + err.message);
        } finally {
            setLoadingCheckout(false);
        }
    };

    // Called when user confirms CPF in the modal
    const handleCpfConfirm = async () => {
        const cleanCpf = cpfInput.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setCpfError('CPF inválido. Informe os 11 dígitos.');
            return;
        }
        setCpfError('');
        setCpfModalOpen(false);

        try {
            setLoadingCheckout(true);

            // Case 1: Company exists but is missing CPF → just update it
            if (pendingCheckoutCompanyId) {
                await supabase
                    .from('companies')
                    .update({ cpf: cleanCpf, entity_type: 'PF' })
                    .eq('id', pendingCheckoutCompanyId);
                setPendingCheckoutCompanyId(null);
                await executeCheckout(pendingCheckoutCompanyId);
                return;
            }

            // Case 2: No company at all → create PF company with CPF
            const userName = profile?.full_name || 'Conta Pessoal';
            const { data: createData, error: createError } = await supabase.rpc('create_company', {
                name_input: userName,
                trade_name_input: userName,
                cnpj_input: '',
                entity_type_input: 'PF',
                cpf_input: cleanCpf,
                email_input: profile?.email || '',
                phone_input: profile?.phone || '',
            });

            if (createError || !createData?.success) {
                const msg = createData?.message || createError?.message || 'Erro ao criar conta.';
                alert('Erro ao preparar sua conta: ' + msg);
                setLoadingCheckout(false);
                return;
            }

            console.log('DEBUG: Empresa PF criada com CPF! ID:', createData.company_id);
            await executeCheckout(createData.company_id);
        } catch (err: any) {
            alert('Erro: ' + err.message);
            setLoadingCheckout(false);
        }
    };

    const handleUpgrade = async () => {
        try {
            setLoadingCheckout(true);

            let targetCompanyId = currentEntity.type === 'personal'
                ? (currentEntity.associated_company_id || profile?.company_id || (companies && companies.length > 0 ? companies[0].id : null))
                : currentEntity.id;

            console.log('DEBUG: Dashboard Checkout - Iniciando', {
                entityType: currentEntity.type,
                associated: currentEntity.associated_company_id,
                profileCompanyId: profile?.company_id,
                companiesCount: companies?.length,
                finalTarget: targetCompanyId
            });

            // If no company exists → ask for CPF first, then create
            if (!targetCompanyId || targetCompanyId === 'personal') {
                setLoadingCheckout(false);
                setCpfInput('');
                setCpfError('');
                setCpfModalOpen(true);
                return;
            }

            // Company exists → check if it has CPF/CNPJ
            const { data: companyData } = await supabase
                .from('companies')
                .select('cpf, cnpj, entity_type')
                .eq('id', targetCompanyId)
                .maybeSingle();

            const hasCpfOrCnpj = (companyData?.cpf && companyData.cpf.replace(/\D/g, '').length >= 11)
                || (companyData?.cnpj && companyData.cnpj.replace(/\D/g, '').length >= 14);

            if (!hasCpfOrCnpj) {
                // Has company but missing document → ask user
                setLoadingCheckout(false);
                setCpfInput('');
                setCpfError('');
                setPendingCheckoutCompanyId(targetCompanyId);
                setCpfModalOpen(true);
                return;
            }

            await executeCheckout(targetCompanyId);
        } catch (err: any) {
            alert('Falha ao processar checkout: ' + err.message);
            setLoadingCheckout(false);
        }
    };

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'income' | 'expense' | 'receivable' | 'payable' | 'balance'>('income');
    const [modalTitle, setModalTitle] = useState('');

    if (loading || categoriesLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 animate-pulse">{t('common.loading') || 'Carregando dados...'}</p>
            </div>
        );
    }

    // Month labels for comparison
    const monthNames = t('dashboard.month_names', { returnObjects: true }) as string[];
    const currentDate = new Date(startDate);
    const currentMonthLabel = monthNames[currentDate.getMonth()] || '';
    const prevDate = new Date(currentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const previousMonthLabel = monthNames[prevDate.getMonth()] || '';

    const isCRMEnabled = currentEntity.type === 'company' &&
        companies.find(c => c.id === currentEntity.id)?.crm_module_enabled;

    // Click handlers for cards
    const handleCardClick = (type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected') => {
        if (type === 'rejected') {
            navigate('/dashboard/quotes', { state: { viewMode: 'recovery' } });
            return;
        }

        setModalType(type as any);
        setModalOpen(true);

        const titles = {
            income: t('dashboard.income_month'),
            expense: t('dashboard.expense_month'),
            receivable: t('dashboard.receivable_pending'),
            payable: t('dashboard.payable_pending'),
            balance: t('dashboard.current_balance')
        };
        setModalTitle(titles[type]);
    };

    // Filter transactions based on modal type
    const getFilteredTransactions = () => {
        if (!transactions) return [];

        const periodTransactions = transactions.filter(t =>
            t.date >= startDate && t.date <= endDate
        );

        switch (modalType) {
            case 'income':
                return periodTransactions.filter(t => t.type === 'income' && t.status === 'received');
            case 'expense':
                return periodTransactions.filter(t => t.type === 'expense' && t.status === 'paid');
            case 'receivable':
                return periodTransactions.filter(t => t.type === 'income' && t.status === 'pending');
            case 'payable':
                return periodTransactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'));
            case 'balance':
                return periodTransactions.filter(t =>
                    (t.type === 'income' && t.status === 'received') ||
                    (t.type === 'expense' && t.status === 'paid')
                );
            default:
                return [];
        }
    };

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? t('dashboard.greeting_morning') : currentHour < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening');
    const firstName = profile?.full_name?.split(' ')[0] || t('common.user');

    return (
        <div className="flex flex-col gap-6">
            {isTrial && trialDaysLeft > 0 && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                            <span>🚀</span> Você está no período de teste gratuito ({trialDaysLeft} dias restantes)
                        </h4>
                        <p className="text-blue-100 text-sm">Aproveite todas as ferramentas do sistema. Quer garantir seu acesso contínuo?</p>
                    </div>
                    <button 
                        onClick={handleUpgrade}
                        disabled={loadingCheckout}
                        className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70 whitespace-nowrap w-full md:w-auto text-center"
                    >
                        {loadingCheckout ? 'Gerando link...' : 'Antecipar Assinatura'}
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {firstName}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard.financial_summary')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker Quick Select */}
                    <Tooltip content={t('dashboard.quick_month_select')}>
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={handleMonthChange}
                            className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        />
                    </Tooltip>
                    <span className="text-gray-400 hidden md:inline">|</span>
                    {/* Manual Date Range */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        />
                        <span className="text-gray-500">{t('common.to')}</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        />
                    </div>
                </div>
            </div>

            <Alerts alerts={alerts} />

            <DashboardCards metrics={metrics} onCardClick={handleCardClick} />

            <ContextSummaryWidget contextMetrics={contextMetrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <DashboardCharts data={chartData} />
                    <ExpenseByCategoryChart expenses={expensesByCategory} categories={categories} />
                    <MonthlyComparison
                        currentIncome={metrics.income}
                        currentExpense={metrics.expense}
                        previousIncome={previousPeriod.income}
                        previousExpense={previousPeriod.expense}
                        currentMonthLabel={currentMonthLabel}
                        previousMonthLabel={previousMonthLabel}
                    />
                    <PendingList transactions={pendingList} />
                    <BudgetProgress categories={categories} expenses={expensesByCategory} />
                </div>

                <div className="space-y-6">
                    {/* CRM Dashboard 360 Widget */}
                    {isCRMEnabled && <CRMStatsWidget receivedIncome={metrics.income} />}

                    {/* Cash Flow Forecast */}
                    <CashFlowForecast
                        currentBalance={metrics.balance}
                        monthlyIncome={metrics.income}
                        monthlyExpense={metrics.expense}
                        pendingReceivable={metrics.totalReceivable}
                        pendingPayable={metrics.totalPayable}
                    />

                    {/* Upcoming Bills Widget */}
                    <UpcomingBillsWidget onRefreshMetrics={refreshDashboard} />

                    {/* Quick Summary Card */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('dashboard.quick_summary')}</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.period_result')}</p>
                                <p className={`text-xl font-bold ${metrics.income - metrics.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.income - metrics.expense)}
                                </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('dashboard.quote_tip')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                transactions={getFilteredTransactions()}
                type={modalType}
                onDelete={handleDelete}
            />

            {/* CPF Modal - Solicita CPF antes do checkout */}
            {cpfModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                <span className="text-xl">📄</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dados para Pagamento</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Precisamos do seu CPF para gerar o link</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Para processar o pagamento como <strong>Pessoa Física</strong>, informe seu CPF abaixo.
                            Ele será usado apenas para identificação no gateway de pagamento.
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CPF
                            </label>
                            <input
                                type="text"
                                value={cpfInput}
                                onChange={e => {
                                    // Format as CPF: 000.000.000-00
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    let formatted = digits;
                                    if (digits.length > 9) formatted = digits.slice(0,3) + '.' + digits.slice(3,6) + '.' + digits.slice(6,9) + '-' + digits.slice(9);
                                    else if (digits.length > 6) formatted = digits.slice(0,3) + '.' + digits.slice(3,6) + '.' + digits.slice(6);
                                    else if (digits.length > 3) formatted = digits.slice(0,3) + '.' + digits.slice(3);
                                    setCpfInput(formatted);
                                    setCpfError('');
                                }}
                                placeholder="000.000.000-00"
                                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg tracking-widest"
                                autoFocus
                            />
                            {cpfError && (
                                <p className="text-red-500 text-sm mt-1">{cpfError}</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setCpfModalOpen(false); setPendingCheckoutCompanyId(null); }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCpfConfirm}
                                disabled={loadingCheckout}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-70"
                            >
                                {loadingCheckout ? 'Processando...' : 'Confirmar e Pagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
