import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, FileText, Wallet, Save, RefreshCw, Shield, Users, Building, DollarSign, Trash2, Lock, MessageSquare, CreditCard, X } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useSettings } from '../hooks/useSettings';
import { useAdmin } from '../hooks/useAdmin';
import { usePresence } from '../hooks/usePresence';
import { useTeam } from '../hooks/useTeam';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { supabase } from '../lib/supabase';
import { SETTINGS_TABS, APP_MODULES, getTabPermission, getModulePermission } from '../config/permissions';
import { WebhookSettings } from './WebhookSettings';
import { WhatsApp } from './WhatsApp';
import { FiscalSettings } from '../components/settings/FiscalSettings';
import { PaymentSettings } from '../components/settings/PaymentSettings';
import { useCharges } from '../hooks/useCharges';
import { useAuth } from '../context/AuthContext';

export function Settings() {
    const { settings, loading, updateSettings, clonePersonalSettings } = useSettings();
    const { isAdmin, stats, usersList, companiesList, loading: adminLoading, refresh: refreshAdmin, deleteUser, toggleUserBan, updateUserConfig, updateCompanyConfig } = useAdmin();
    const { members, invites, loading: teamLoading, inviteMember, removeMember, cancelInvite, copyInviteLink, refresh: refreshTeam } = useTeam();
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { companies } = useCompanies();
    const { createCharge, charges: recentCharges, loading: chargesLoading, fetchCharges: refreshCharges } = useCharges();
    const { profile } = useAuth();

    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [cloning, setCloning] = useState(false);

    // Local state for form inputs
    const [quoteValidity, setQuoteValidity] = useState(7);
    const [commissionRate, setCommissionRate] = useState(0);
    const [serviceCommissionRate, setServiceCommissionRate] = useState(0);
    const [productCommissionRate, setProductCommissionRate] = useState(0);

    // Company Settings State


    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [inviting, setInviting] = useState(false);

    const [activeTab, setActiveTab] = useState<'quotes' | 'financial' | 'team' | 'webhooks' | 'whatsapp' | 'fiscal' | 'payments' | 'admin'>('quotes');
    const [adminSubTab, setAdminSubTab] = useState<'users' | 'companies' | 'invoices'>('users');
    const [selectedCompanyForConfig, setSelectedCompanyForConfig] = useState<any | null>(null);
    const [selectedCompanyForInvoice, setSelectedCompanyForInvoice] = useState<any | null>(null);
    const [invoiceData, setInvoiceData] = useState({ amount: '', description: '' });
    const [generatingInvoice, setGeneratingInvoice] = useState(false);
    const [selectedUserForConfig, setSelectedUserForConfig] = useState<any | null>(null);

    // Update local state when company settings load
    useEffect(() => {
        // Company settings effect removed as it's now handled in the Super Admin modal for central management
    }, [currentEntity, companies]);

    // Listen for online users only if admin
    usePresence(isAdmin);

    // Removed global email restriction to allow team management for all users
    // Admin tab is still protected by isAdmin check

    useEffect(() => {
        if (!loading) {
            setQuoteValidity(settings.quote_validity_days || 7);
            setCommissionRate(settings.commission_rate || 0);
            setServiceCommissionRate(settings.service_commission_rate || 0);
            setProductCommissionRate(settings.product_commission_rate || 0);
        }
    }, [settings, loading]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await updateSettings({
            quote_validity_days: quoteValidity,
            commission_rate: commissionRate,
            service_commission_rate: serviceCommissionRate,
            product_commission_rate: productCommissionRate
        });
        setSaving(false);
        if (error) {
            alert('Erro ao salvar as configurações.');
        } else {
            alert('Configurações salvas com sucesso!');
        }
    };

    const handleSyncTransactions = async () => {
        setSyncing(true);
        try {
            // 1. Get all approved quotes
            const { data: quotes } = await supabase
                .from('quotes')
                .select('id, title, status')
                .eq('status', 'approved');

            if (!quotes) return;

            let updatedCount = 0;

            // 2. For each quote, find matching transaction by description pattern
            for (const quote of quotes) {
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('id, status')
                    .ilike('description', `% Ref.Orçamento: ${quote.title}%`);

                if (transactions && transactions.length > 0) {
                    // Update transaction with quote_id
                    for (const tx of transactions) {
                        await supabase
                            .from('transactions')
                            .update({ quote_id: quote.id })
                            .eq('id', tx.id);

                        // Also sync payment status back to quote if needed
                        if (tx.status === 'paid' || tx.status === 'received') {
                            await supabase
                                .from('quotes')
                                .update({ payment_status: 'paid' })
                                .eq('id', quote.id);
                        }
                        updatedCount++;
                    }
                }
            }
            alert(`Sincronização concluída! ${updatedCount} registros atualizados.`);
        } catch (error) {
            console.error(error);
            alert('Erro ao sincronizar.');
        } finally {
            setSyncing(false);
        }
    };

    const handleImportFromPersonal = async () => {
        if (!confirm('Deseja importar todas as taxas e validade da sua conta pessoal para esta empresa? Isso substituirá os valores atuais.')) return;

        setCloning(true);
        const { error } = await clonePersonalSettings();
        setCloning(false);

        if (error) {
            alert('Erro ao importar: ' + error);
        } else {
            alert('Configurações importadas da conta pessoal!');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        const { error } = await inviteMember(inviteEmail, inviteRole);
        setInviting(false);
        if (error) {
            alert('Erro ao enviar convite: ' + error);
        } else {
            alert('Convite enviado com sucesso!');
            setInviteEmail('');
        }
    };

    const getDaysRemaining = (dateString?: string) => {
        if (!dateString) return null;
        const diffTime = new Date(dateString).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const handleGenerateInvoice = async () => {
        if (!selectedCompanyForInvoice || !invoiceData.amount) return;

        setGeneratingInvoice(true);
        try {
            // Reusar gatewy master (do Super Admin atual)
            const masterCompanyId = profile?.company_id;
            if (!masterCompanyId) {
                alert('Erro: Sua conta Master não está vinculada a uma empresa para receber pagamentos.');
                return;
            }

            // Buscar gateway ativo da empresa master
            const { data: gateways } = await supabase
                .from('payment_gateways')
                .select('*')
                .eq('company_id', masterCompanyId)
                .eq('is_active', true)
                .limit(1);

            if (!gateways || gateways.length === 0) {
                alert('Erro: Você não possui um gateway de pagamento ativo na sua conta Master.');
                return;
            }

            const gateway = gateways[0];

            const result = await createCharge({
                provider: gateway.provider,
                config: gateway.config,
                is_sandbox: gateway.is_sandbox,
                payload: {
                    amount: parseFloat(invoiceData.amount),
                    description: invoiceData.description,
                    payment_method: 'pix',
                    customer: {
                        name: selectedCompanyForInvoice.trade_name,
                        email: selectedCompanyForInvoice.owner_email || '',
                        tax_id: selectedCompanyForInvoice.cnpj
                    }
                }
            });

            if (result.success) {
                alert('Fatura gerada com sucesso! Você pode copiar o link na aba de faturas.');
                setSelectedCompanyForInvoice(null);
                setAdminSubTab('invoices');
                refreshCharges();
            } else {
                alert('Erro ao gerar fatura: ' + result.error);
            }
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setGeneratingInvoice(false);
        }
    };

    if (loading) return <div className="p-6">Carregando configurações...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="text-blue-600" />
                        Configurações do Sistema
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie as preferências globais da aplicação.</p>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
                {[
                    { key: 'quotes', label: 'Orçamentos', icon: FileText, color: 'blue' },
                    { key: 'financial', label: 'Financeiro', icon: Wallet, color: 'blue' },
                    { key: 'team', label: 'Time', icon: Users, color: 'blue' },
                    { key: 'webhooks', label: 'Webhooks', icon: SettingsIcon, color: 'purple' },
                    { key: 'whatsapp', label: 'WhatsApp API', icon: MessageSquare, color: 'green' },
                    { key: 'payments', label: 'Pagamentos', icon: CreditCard, color: 'emerald' },
                    { key: 'fiscal', label: 'Fiscal (TecnoSpeed)', icon: FileText, color: 'indigo' },
                    ...(isAdmin ? [{ key: 'admin', label: 'Administração', icon: Shield, color: 'purple' }] : [])
                ].filter(tab => {
                    const currentCompany = companies.find(c => c.id === currentEntity.id);

                    // Show Fiscal tab only if enabled for company
                    if (tab.key === 'fiscal') {
                        return currentEntity.type === 'company' && currentCompany?.fiscal_module_enabled;
                    }

                    // Show Payments tab only if enabled for company
                    if (tab.key === 'payments') {
                        return currentEntity.type === 'company' && currentCompany?.payments_module_enabled;
                    }

                    // Hide company-specific tabs in personal context
                    if (currentEntity.type === 'personal') {
                        const companyOnlyTabs = ['financial', 'team', 'webhooks'];
                        if (companyOnlyTabs.includes(tab.key)) {
                            return false;
                        }
                    }

                    // Always show Admin tab to system admin
                    if (tab.key === 'admin') return true;

                    // Bypass for System Admin - they see all tabs
                    if (isAdmin) return true;

                    // Matrix-based filtering
                    const matrix = currentEntity.settings || {};
                    const role = currentEntity.type === 'company' ? (currentEntity.role || 'member') : 'admin';

                    return getTabPermission(tab.key, role as any, matrix);
                }).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`pb-3 px-4 flex items-center gap-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.key
                            ? `border-b-2 border-${tab.color}-600 text-${tab.color}-600 dark:text-${tab.color}-400`
                            : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6">
                {activeTab === 'quotes' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <FileText className="text-blue-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Padrões de Orçamento</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Defina os valores padrão que serão preenchidos automaticamente ao criar um novo orçamento.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Validade Padrão (Dias)"
                                type="number"
                                value={quoteValidity}
                                onChange={(e) => setQuoteValidity(parseInt(e.target.value) || 0)}
                                placeholder="Ex: 7"
                                min="1"
                                helpText="Número de dias que a proposta será válida a partir da data de criação."
                            />
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={saving}>
                                <Save size={18} className="mr-2" />
                                Salvar Configurações
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <Wallet className="text-green-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Taxas e Comissões</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Configure as taxas administrativas cobradas pela plataforma ou meios de pagamento.
                                </p>
                            </div>
                        </div>


                        {currentEntity.type === 'company' && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleImportFromPersonal}
                                    isLoading={cloning}
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                    <RefreshCw size={14} className="mr-2" />
                                    Importar da Conta Pessoal
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <Input
                                    label="Taxa de Recebimento (%)"
                                    type="number"
                                    value={commissionRate}
                                    onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 4.5"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText="Percentual descontado automaticamente de cada recebimento (ex: taxa de cartão/intermediação)."
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    label="Comissão Serviços (%)"
                                    type="number"
                                    value={serviceCommissionRate}
                                    onChange={(e) => setServiceCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 10"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText="Taxa de comissão padrão para serviços."
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    label="Comissão Produtos (%)"
                                    type="number"
                                    value={productCommissionRate}
                                    onChange={(e) => setProductCommissionRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 5"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    helpText="Taxa de comissão padrão para produtos."
                                />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={saving}>
                                <Save size={18} className="mr-2" />
                                Salvar Configurações
                            </Button>
                        </div>

                        {/* Maintenance Section moved here to be part of Financial or just general Settings footer? 
                            Keeping it inside Financial or separate? Previously it was at bottom of page. 
                            Let's keep it here for now or at the bottom. 
                            Actually, the user replaced the whole component, so I'll put it at the bottom of the financial tab or page.
                            The previous code had it outside the tabs. Let's keep it outside tabs if possible or put it in financial.
                            I'll put it in Financial for now as it relates to transactions.
                         */}
                        <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Manutenção</h3>
                            <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg flex items-center justify-between">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Sincronizar status de pagamento entre orçamentos e transações.
                                </p>
                                <Button variant="outline" size="sm" onClick={handleSyncTransactions} isLoading={syncing}>
                                    <RefreshCw size={16} />
                                    Sincronizar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="space-y-8">
                        {/* Invite Section */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Convidar Membro</h3>
                            <form onSubmit={handleInvite} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <Input
                                        label="Email do Usuário"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="exemplo@email.com"
                                        required
                                    />
                                </div>
                                <div className="w-48">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Função
                                    </label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                                        className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="member">Membro</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <Button type="submit" isLoading={inviting} className="mb-[2px]">
                                    Convidar
                                </Button>
                            </form>
                        </div>

                        {/* Members List */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Membros da Equipe</h3>
                                <Button size="sm" variant="ghost" onClick={refreshTeam} isLoading={teamLoading}>
                                    <RefreshCw size={16} />
                                </Button>
                            </div>

                            <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nome / Email</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Função</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Entrou em</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                        {teamLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    Carregando equipe...
                                                </td>
                                            </tr>
                                        ) : members.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    Nenhum membro encontrado.
                                                </td>
                                            </tr>
                                        ) : (
                                            members.map((m) => (
                                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {m.profile.full_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{m.profile.email}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs border capitalize ${m.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                            {m.role === 'owner' ? '👑 Platform Owner' : m.role === 'admin' ? 'Admin' : 'Membro'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-200">
                                                            Ativo
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500">
                                                        {new Date(m.joined_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {m.role !== 'owner' && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Remover este membro?')) removeMember(m.id);
                                                                }}
                                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                                            >
                                                                Remover
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Invites List */}
                        {invites.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Convites Pendentes</h3>
                                <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Email</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Função</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Expira em</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                            {invites.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                        {inv.email}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="capitalize text-gray-600">{inv.role}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500">
                                                        {new Date(inv.expires_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => copyInviteLink(inv.token)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            Copiar Link
                                                        </button>
                                                        <button
                                                            onClick={() => cancelInvite(inv.id)}
                                                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'webhooks' && (
                    <WebhookSettings />
                )}

                {activeTab === 'whatsapp' && (
                    <WhatsApp />
                )}

                {activeTab === 'fiscal' && (
                    <FiscalSettings />
                )}

                {activeTab === 'payments' && (
                    <PaymentSettings />
                )}

                {/* Per-Company Config Modal */}
                {selectedCompanyForConfig && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurar Empresa</h2>
                                        <p className="text-sm text-gray-500">{selectedCompanyForConfig.trade_name} • {selectedCompanyForConfig.cnpj}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCompanyForConfig(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-10">
                                {/* Direct Module Toggles (Legacy/Quick) */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Módulo Fiscal</h4>
                                                <p className="text-xs text-gray-500">Habilita emissão de notas fiscais</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!selectedCompanyForConfig.fiscal_module_enabled}
                                                    onChange={async (e) => {
                                                        const val = e.target.checked;
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            val,
                                                            !!selectedCompanyForConfig.payments_module_enabled,
                                                            !!selectedCompanyForConfig.crm_module_enabled,
                                                            selectedCompanyForConfig.settings || {}
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else {
                                                            setSelectedCompanyForConfig({ ...selectedCompanyForConfig, fiscal_module_enabled: val });
                                                            refreshEntity();
                                                        }
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Módulo Pagamentos</h4>
                                                <p className="text-xs text-gray-500">Habilita links de pagamento e checkout</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!selectedCompanyForConfig.payments_module_enabled}
                                                    onChange={async (e) => {
                                                        const val = e.target.checked;
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            !!selectedCompanyForConfig.fiscal_module_enabled,
                                                            val,
                                                            !!selectedCompanyForConfig.crm_module_enabled,
                                                            selectedCompanyForConfig.settings || {}
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else {
                                                            setSelectedCompanyForConfig({ ...selectedCompanyForConfig, payments_module_enabled: val });
                                                            refreshEntity();
                                                        }
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Módulo CRM</h4>
                                                <p className="text-xs text-gray-500">Habilita Funil de Vendas e Negócios</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!selectedCompanyForConfig.crm_module_enabled}
                                                    onChange={async (e) => {
                                                        const val = e.target.checked;
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            !!selectedCompanyForConfig.fiscal_module_enabled,
                                                            !!selectedCompanyForConfig.payments_module_enabled,
                                                            val,
                                                            selectedCompanyForConfig.settings || {}
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else {
                                                            setSelectedCompanyForConfig({ ...selectedCompanyForConfig, crm_module_enabled: val });
                                                            refreshEntity();
                                                        }
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">Exclusão de Dados</h4>
                                                <p className="text-xs text-gray-500">Membros podem excluir registros</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={selectedCompanyForConfig.settings?.member_can_delete}
                                                    onChange={async (e) => {
                                                        const val = e.target.checked;
                                                        const newSettings = {
                                                            ...selectedCompanyForConfig.settings,
                                                            member_can_delete: val
                                                        };
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            !!selectedCompanyForConfig.fiscal_module_enabled,
                                                            !!selectedCompanyForConfig.payments_module_enabled,
                                                            !!selectedCompanyForConfig.crm_module_enabled,
                                                            newSettings
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Platform Commission Setting */}
                                <div className="p-6 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-900/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                            <DollarSign size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Taxa da Plataforma (Sua Comissão)</h4>
                                            <p className="text-sm text-gray-500">Defina a porcentagem que você recebe sobre cada transação desta empresa.</p>
                                        </div>
                                    </div>
                                    <Input
                                        label="Porcentagem de Comissão (%)"
                                        type="number"
                                        value={selectedCompanyForConfig.settings?.commission_rate || 0}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            const newSettings = {
                                                ...(selectedCompanyForConfig.settings || {}),
                                                commission_rate: rate
                                            };
                                            setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                        }}
                                        onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            const newSettings = {
                                                ...(selectedCompanyForConfig.settings || {}),
                                                commission_rate: rate
                                            };
                                            const { error } = await updateCompanyConfig(
                                                selectedCompanyForConfig.id,
                                                !!selectedCompanyForConfig.fiscal_module_enabled,
                                                !!selectedCompanyForConfig.payments_module_enabled,
                                                !!selectedCompanyForConfig.crm_module_enabled,
                                                newSettings
                                            );
                                            if (error) alert('Erro: ' + error);
                                        }}
                                        placeholder="Ex: 5"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                    />
                                </div>

                                {/* Subscription Plan (Monthly & Annual) */}
                                <div className="p-6 rounded-xl border-2 border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10 space-y-6">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">Plano de Assinatura (Mensalidade e Licença)</h4>
                                            <p className="text-sm text-gray-500">Controle os valores fixos de mensalidade e licença anual.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <Input
                                            label="Mensalidade (R$ / mês)"
                                            type="number"
                                            value={selectedCompanyForConfig.settings?.monthly_fee || 0}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newSettings = { ...(selectedCompanyForConfig.settings || {}), monthly_fee: val };
                                                setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                            }}
                                            onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newSettings = { ...(selectedCompanyForConfig.settings || {}), monthly_fee: val };
                                                const { error } = await updateCompanyConfig(
                                                    selectedCompanyForConfig.id,
                                                    !!selectedCompanyForConfig.fiscal_module_enabled,
                                                    !!selectedCompanyForConfig.payments_module_enabled,
                                                    !!selectedCompanyForConfig.crm_module_enabled,
                                                    newSettings
                                                );
                                                if (error) alert('Erro: ' + error);
                                            }}
                                            placeholder="Ex: 150"
                                        />
                                        <Input
                                            label="Licença Anual (R$ / ano)"
                                            type="number"
                                            value={selectedCompanyForConfig.settings?.annual_fee || 0}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newSettings = { ...(selectedCompanyForConfig.settings || {}), annual_fee: val };
                                                setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                            }}
                                            onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newSettings = { ...(selectedCompanyForConfig.settings || {}), annual_fee: val };
                                                const { error } = await updateCompanyConfig(
                                                    selectedCompanyForConfig.id,
                                                    !!selectedCompanyForConfig.fiscal_module_enabled,
                                                    !!selectedCompanyForConfig.payments_module_enabled,
                                                    !!selectedCompanyForConfig.crm_module_enabled,
                                                    newSettings
                                                );
                                                if (error) alert('Erro: ' + error);
                                            }}
                                            placeholder="Ex: 1200"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                label="Vencimento da Licença"
                                                type="date"
                                                value={selectedCompanyForConfig.settings?.license_expires_at ? new Date(selectedCompanyForConfig.settings.license_expires_at).toISOString().split('T')[0] : ''}
                                                onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const val = e.target.value;
                                                    const newSettings = { ...(selectedCompanyForConfig.settings || {}), license_expires_at: val };
                                                    const { error } = await updateCompanyConfig(
                                                        selectedCompanyForConfig.id,
                                                        !!selectedCompanyForConfig.fiscal_module_enabled,
                                                        !!selectedCompanyForConfig.payments_module_enabled,
                                                        !!selectedCompanyForConfig.crm_module_enabled,
                                                        newSettings
                                                    );
                                                    if (error) alert('Erro: ' + error);
                                                    else setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    const nextYear = new Date();
                                                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                                                    const val = nextYear.toISOString().split('T')[0];
                                                    const newSettings = { ...(selectedCompanyForConfig.settings || {}), license_expires_at: val };
                                                    const { error } = await updateCompanyConfig(
                                                        selectedCompanyForConfig.id,
                                                        selectedCompanyForConfig.fiscal_module_enabled,
                                                        selectedCompanyForConfig.payments_module_enabled,
                                                        selectedCompanyForConfig.crm_module_enabled,
                                                        newSettings
                                                    );
                                                    if (error) alert('Erro: ' + error);
                                                    else setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                                }}
                                                className="text-[10px] w-fit font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                            >
                                                Renovar 1 Ano
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions Matrix */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Lock size={18} className="text-orange-500" />
                                        Matriz de Acesso aos Módulos
                                    </h4>
                                    <div className="overflow-hidden border border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200">Módulo</th>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200 text-center">Admin</th>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200 text-center">Membro</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                {APP_MODULES.map((module) => {
                                                    const settings = selectedCompanyForConfig.settings || {};
                                                    const modules = settings.modules || {};
                                                    const adminEnabled = getModulePermission(module.key, 'admin', settings);
                                                    const memberEnabled = getModulePermission(module.key, 'member', settings);

                                                    const toggleMod = async (role: 'admin' | 'member', value: boolean) => {
                                                        const newSettings = {
                                                            ...settings,
                                                            modules: {
                                                                ...modules,
                                                                [module.key]: {
                                                                    ...modules[module.key],
                                                                    [role]: value
                                                                }
                                                            }
                                                        };
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            selectedCompanyForConfig.fiscal_module_enabled,
                                                            selectedCompanyForConfig.payments_module_enabled,
                                                            selectedCompanyForConfig.crm_module_enabled,
                                                            newSettings
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                                    };

                                                    return (
                                                        <tr key={module.key} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-5 py-4 text-gray-800 dark:text-gray-300 font-medium">{module.label}</td>
                                                            <td className="px-5 py-4 text-center">
                                                                <input type="checkbox" checked={adminEnabled} onChange={(e) => toggleMod('admin', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                            </td>
                                                            <td className="px-5 py-4 text-center">
                                                                <input type="checkbox" checked={memberEnabled} onChange={(e) => toggleMod('member', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Tabs Matrix */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <SettingsIcon size={18} className="text-purple-500" />
                                        Matriz de Acesso: Abas de Configuração
                                    </h4>
                                    <div className="overflow-hidden border border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/50 shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200">Aba</th>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200 text-center">Admin</th>
                                                    <th className="px-5 py-4 font-bold text-gray-700 dark:text-gray-200 text-center">Membro</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                {SETTINGS_TABS.map((tab) => {
                                                    const settings = selectedCompanyForConfig.settings || {};
                                                    const tabs = settings.settings_tabs || {};
                                                    const adminEnabled = getTabPermission(tab.key, 'admin', settings);
                                                    const memberEnabled = getTabPermission(tab.key, 'member', settings);

                                                    const toggleTb = async (role: 'admin' | 'member', value: boolean) => {
                                                        const newSettings = {
                                                            ...settings,
                                                            settings_tabs: {
                                                                ...tabs,
                                                                [tab.key]: {
                                                                    ...tabs[tab.key],
                                                                    [role]: value
                                                                }
                                                            }
                                                        };
                                                        const { error } = await updateCompanyConfig(
                                                            selectedCompanyForConfig.id,
                                                            selectedCompanyForConfig.fiscal_module_enabled,
                                                            selectedCompanyForConfig.payments_module_enabled,
                                                            selectedCompanyForConfig.crm_module_enabled,
                                                            newSettings
                                                        );
                                                        if (error) alert('Erro: ' + error);
                                                        else setSelectedCompanyForConfig({ ...selectedCompanyForConfig, settings: newSettings });
                                                    };

                                                    return (
                                                        <tr key={tab.key} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-5 py-4 text-gray-800 dark:text-gray-300 font-medium">{tab.label}</td>
                                                            <td className="px-5 py-4 text-center">
                                                                <input type="checkbox" checked={adminEnabled} onChange={(e) => toggleTb('admin', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                            </td>
                                                            <td className="px-5 py-4 text-center">
                                                                <input type="checkbox" checked={memberEnabled} onChange={(e) => toggleTb('member', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end">
                                <Button onClick={() => setSelectedCompanyForConfig(null)} variant="primary">Concluído</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Per-User Config Modal */}
                {selectedUserForConfig && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurar Usuário</h2>
                                        <p className="text-sm text-gray-500">{selectedUserForConfig.full_name} • {selectedUserForConfig.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedUserForConfig(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-6">
                                {/* User-specific settings */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Lock size={18} className="text-blue-500" />
                                        Permissões Pessoais
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/20">
                                            <div>
                                                <h5 className="font-bold text-gray-900 dark:text-white">Pode Criar Empresas</h5>
                                                <p className="text-xs text-gray-500">Permite ao usuário criar novas empresas (PJ)</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={selectedUserForConfig.can_create_companies}
                                                    onChange={async (e) => {
                                                        const newVal = e.target.checked;
                                                        const newSettings = { ...(selectedUserForConfig.settings || {}), can_create_companies: newVal };
                                                        const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                        if (error) alert('Erro: ' + error);
                                                        else setSelectedUserForConfig({ ...selectedUserForConfig, can_create_companies: newVal, settings: newSettings });
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Modules Matrix */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Acesso aos Módulos (Sidebar)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {APP_MODULES.filter(m => !['dashboard', 'companies', 'settings'].includes(m.key)).map(module => {
                                            const isEnabled = selectedUserForConfig.settings?.modules?.[module.key]?.admin !== false;
                                            return (
                                                <div key={module.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                                            <module.icon size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{module.label}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isEnabled}
                                                            onChange={async (e) => {
                                                                const newVal = e.target.checked;
                                                                const currentSettings = selectedUserForConfig.settings || {};
                                                                const newSettings = {
                                                                    ...currentSettings,
                                                                    modules: {
                                                                        ...(currentSettings.modules || {}),
                                                                        [module.key]: { admin: newVal, member: newVal }
                                                                    }
                                                                };
                                                                const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                                if (error) alert('Erro: ' + error);
                                                                else setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                            }}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tabs Matrix */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Abas de Configuração</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {SETTINGS_TABS.filter(t => !['admin', 'permissions'].includes(t.key)).map(tab => {
                                            const isEnabled = selectedUserForConfig.settings?.settings_tabs?.[tab.key]?.admin !== false;
                                            return (
                                                <div key={tab.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                                                            <tab.icon size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tab.label}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isEnabled}
                                                            onChange={async (e) => {
                                                                const newVal = e.target.checked;
                                                                const currentSettings = selectedUserForConfig.settings || {};
                                                                const newSettings = {
                                                                    ...currentSettings,
                                                                    settings_tabs: {
                                                                        ...(currentSettings.settings_tabs || {}),
                                                                        [tab.key]: { admin: newVal, member: newVal }
                                                                    }
                                                                };
                                                                const { error } = await updateUserConfig(selectedUserForConfig.id, newSettings);
                                                                if (error) alert('Erro: ' + error);
                                                                else setSelectedUserForConfig({ ...selectedUserForConfig, settings: newSettings });
                                                            }}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end">
                                <Button onClick={() => setSelectedUserForConfig(null)} variant="primary">Concluído</Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && isAdmin && (
                    <div className="space-y-8">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Total Usuários</span>
                                    <Users size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : stats?.total_users || 0}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Registros na plataforma
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Empresas (PJ)</span>
                                    <Building size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : stats?.total_companies || 0}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Contas corporativas
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Volume Processado</span>
                                    <DollarSign size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.total_revenue || 0)}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Total de vendas (Recebidas)
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-6 text-white shadow-lg">
                                <div className="flex items-center justify-between opacity-80 mb-4">
                                    <span className="text-sm font-medium">Comissão Plataforma</span>
                                    <Wallet size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.total_commission || 0)}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Sua receita estimada
                                </div>
                            </div>
                        </div>

                        {/* Admin Sub-tabs */}
                        <div className="flex border-b border-gray-200 dark:border-slate-700">
                            {[
                                { id: 'users', label: 'Usuários', icon: Users },
                                { id: 'companies', label: 'Empresas', icon: Building },
                                { id: 'invoices', label: 'Faturas de Cobrança', icon: CreditCard },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setAdminSubTab(tab.id as any)}
                                    className={`flex items - center gap - 2 px - 6 py - 3 border - b - 2 transition - all ${adminSubTab === tab.id
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                                        } `}
                                >
                                    <tab.icon size={18} />
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Admin Sections */}
                        {adminSubTab === 'users' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Movimento de Usuários</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()} isLoading={adminLoading}>
                                        <RefreshCw size={16} className={adminLoading ? 'animate-spin' : ''} />
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Usuário / Email</th>
                                                <th className="px-4 py-3">Tipo</th>
                                                <th className="px-4 py-3 text-center">Config</th>
                                                <th className="px-4 py-3 text-center">Atividades</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando dados...</td>
                                                </tr>
                                            ) : usersList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum usuário encontrado.</td>
                                                </tr>
                                            ) : (
                                                usersList.map((u) => {
                                                    const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
                                                    return (
                                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p - 2 rounded - full ${isBanned ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} `}>
                                                                        <Users size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <div className={`font - medium ${isBanned ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'} `}>{u.full_name || 'Sem nome'}</div>
                                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px - 2 py - 0.5 rounded text - [10px] uppercase font - bold border ${u.user_type === 'PJ' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-600'} `}>
                                                                    {u.user_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{u.max_companies ?? 1}</span>
                                                                    <Tooltip content="Configurar Usuário">
                                                                        <button onClick={() => setSelectedUserForConfig(u)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-blue-500">
                                                                            <Lock size={14} />
                                                                        </button>
                                                                    </Tooltip>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex flex-col text-[10px] text-gray-500">
                                                                    <span>{u.quotes_count || 0} Orç.</span>
                                                                    <span>{u.transactions_count || 0} Tx.</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={!isBanned}
                                                                        onChange={() => toggleUserBan(u.id, !isBanned)}
                                                                    />
                                                                    <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer dark:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                                </label>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button onClick={() => { if (confirm('Excluir usuário?')) deleteUser(u.id); }} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'companies' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestão de Empresas</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()} isLoading={adminLoading}>
                                        <RefreshCw size={16} className={adminLoading ? 'animate-spin' : ''} />
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Logo / Empresa</th>
                                                <th className="px-4 py-3 text-center">Responsável</th>
                                                <th className="px-4 py-3 text-center">Plano / Licença</th>
                                                <th className="px-4 py-3 text-center">Faturamento</th>
                                                <th className="px-4 py-3 text-center">Sua Comissão</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {adminLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Carregando empresas...</td>
                                                </tr>
                                            ) : companiesList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhuma empresa encontrada.</td>
                                                </tr>
                                            ) : (
                                                companiesList.map((c) => (
                                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded border border-gray-100 dark:border-slate-700 overflow-hidden bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
                                                                    {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-contain" /> : <Building className="text-gray-400" size={16} />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-900 dark:text-white leading-tight">{c.trade_name}</div>
                                                                    <div className="text-[9px] text-gray-500 font-mono italic">{c.cnpj}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-[11px]">
                                                            <div className="font-medium text-gray-900 dark:text-white">{c.owner_name}</div>
                                                            <div className="text-gray-400">{c.owner_email}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                                                                    <span className="text-[10px]">M:</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.settings?.monthly_fee || 0)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium">
                                                                    <span>A:</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.settings?.annual_fee || 0)}</span>
                                                                </div>
                                                                {c.license_expires_at && (
                                                                    <div className={`mt - 1 px - 2 py - 0.5 rounded - full text - [9px] font - bold ${getDaysRemaining(c.license_expires_at)! < 0 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                        getDaysRemaining(c.license_expires_at)! < 30 ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                                            'bg-blue-50 text-blue-600 border border-blue-100'
                                                                        } `}>
                                                                        Expira {new Date(c.license_expires_at).toLocaleDateString('pt-BR')}
                                                                        <span className="ml-1 opacity-75">
                                                                            ({getDaysRemaining(c.license_expires_at)! < 0 ? 'Expirado' : `Faltam ${getDaysRemaining(c.license_expires_at)} dias`})
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-bold text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_revenue || 0)}</span>
                                                                <span className="text-[9px] text-gray-500 font-medium">Total Recebido</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.commission_earned || 0)}</span>
                                                                {c.settings?.commission_rate > 0 && (
                                                                    <span className="text-[9px] text-gray-500 font-medium">{c.settings.commission_rate}% (Geral)</span>
                                                                )}
                                                                {c.settings?.service_commission_rate > 0 && (
                                                                    <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">{c.settings.service_commission_rate}% Serviços</span>
                                                                )}
                                                                {c.settings?.product_commission_rate > 0 && (
                                                                    <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">{c.settings.product_commission_rate}% Produtos</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 px-2 text-[10px] gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                                                    onClick={() => {
                                                                        setSelectedCompanyForInvoice(c);
                                                                        const month = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                                                        const monthlyFee = c.settings?.monthly_fee || 0;
                                                                        const commissions = c.commission_earned || 0;
                                                                        setInvoiceData({
                                                                            amount: (monthlyFee + commissions).toString(),
                                                                            description: `Mensalidade + Comissões - ${c.trade_name} - ${month} `
                                                                        });
                                                                    }}
                                                                >
                                                                    <CreditCard size={14} />
                                                                    Fatura
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="primary"
                                                                    className="h-8 px-3 text-[10px] gap-1.5 rounded-lg"
                                                                    onClick={() => setSelectedCompanyForConfig(c)}
                                                                >
                                                                    <Shield size={14} />
                                                                    Configurar
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminSubTab === 'invoices' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Faturas Geradas</h3>
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()}>
                                        <RefreshCw size={16} />
                                    </Button>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex items-start gap-3">
                                    <Shield className="text-blue-600 mt-0.5" size={18} />
                                    <div className="text-[11px] text-blue-700 dark:text-blue-300">
                                        Estas são faturas geradas por você para as empresas. O pagamento cairá na sua conta Master vinculada.
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Empresa / Referência</th>
                                                <th className="px-4 py-3 text-center">Valor</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                            {chargesLoading ? (
                                                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Carregando...</td></tr>
                                            ) : recentCharges.length === 0 ? (
                                                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhuma fatura encontrada.</td></tr>
                                            ) : (
                                                recentCharges.map((chg) => (
                                                    <tr key={chg.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-900 dark:text-white leading-tight">{chg.description}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">Ref: {chg.external_reference}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chg.amount)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px - 2 py - 0.5 rounded - full text - [10px] font - bold border ${chg.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                chg.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                                } `}>
                                                                {chg.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                <Tooltip content="Copiar Link">
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(chg.payment_link || '');
                                                                            alert('Link copiado!');
                                                                        }}
                                                                        className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                                                                    >
                                                                        <CreditCard size={14} />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Gerar Fatura */}
            {selectedCompanyForInvoice && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <CreditCard className="text-blue-600" size={20} />
                                Gerar Fatura Admin
                            </h2>
                            <button onClick={() => setSelectedCompanyForInvoice(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">EMPRESA DESTINO</div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompanyForInvoice.trade_name}</div>
                                <div className="text-[10px] text-gray-500">{selectedCompanyForInvoice.cnpj}</div>
                            </div>

                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Detalhamento da Cobrança</div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Mensalidade Fixa:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyForInvoice.settings?.monthly_fee || 0)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Comissões Acumuladas:</span>
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCompanyForInvoice.commission_earned || 0)}</span>
                                </div>
                                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex justify-between text-sm font-bold">
                                    <span className="text-gray-700 dark:text-gray-300">Total Sugerido:</span>
                                    <span className="text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((selectedCompanyForInvoice.settings?.monthly_fee || 0) + (selectedCompanyForInvoice.commission_earned || 0))}</span>
                                </div>
                            </div>

                            <Input
                                label="Valor da Fatura (R$)"
                                type="number"
                                value={invoiceData.amount}
                                onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })}
                                placeholder="0.00"
                                step="0.01"
                            />

                            <Input
                                label="Descrição / Referência"
                                value={invoiceData.description}
                                onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
                                placeholder="Ex: Mensalidade Fevereiro/2024"
                            />

                            <div className="pt-4 flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setSelectedCompanyForInvoice(null)}>Cancelar</Button>
                                <Button className="flex-1" onClick={handleGenerateInvoice} isLoading={generatingInvoice}>Gerar Link</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
