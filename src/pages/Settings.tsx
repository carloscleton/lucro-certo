import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, FileText, Wallet, Save, RefreshCw, Shield, Users, Building, DollarSign, Trash2, Edit2, Lock, ShieldAlert, MessageSquare, CreditCard } from 'lucide-react';
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

export function Settings() {
    const { settings, loading, updateSettings, clonePersonalSettings } = useSettings();
    const { isAdmin, stats, usersList, companiesList, loading: adminLoading, refresh: refreshAdmin, deleteUser, toggleUserBan, updateUserLimit, updateCompanyConfig } = useAdmin();
    const { members, invites, loading: teamLoading, inviteMember, removeMember, cancelInvite, copyInviteLink, refresh: refreshTeam } = useTeam();
    const { currentEntity } = useEntity();
    const { updateCompany, companies } = useCompanies();

    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [cloning, setCloning] = useState(false);

    // Local state for form inputs
    const [quoteValidity, setQuoteValidity] = useState(7);
    const [commissionRate, setCommissionRate] = useState(0);
    const [serviceCommissionRate, setServiceCommissionRate] = useState(0);
    const [productCommissionRate, setProductCommissionRate] = useState(0);

    // Company Settings State
    const [memberCanDelete, setMemberCanDelete] = useState(true);


    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [inviting, setInviting] = useState(false);

    const [activeTab, setActiveTab] = useState<'quotes' | 'financial' | 'team' | 'webhooks' | 'admin' | 'permissions' | 'whatsapp' | 'fiscal' | 'payments'>('quotes');

    // Update local state when company settings load
    useEffect(() => {
        if (currentEntity.type === 'company' && currentEntity.id) {
            const currentCompany = companies.find(c => c.id === currentEntity.id);
            if (currentCompany?.settings) {
                setMemberCanDelete(currentCompany.settings.member_can_delete ?? false);

            }
        }
    }, [currentEntity, companies]);

    // Listen for online users only if admin
    const { onlineUsers } = usePresence(isAdmin);

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
                    .ilike('description', `%Ref. Orçamento: ${quote.title}%`);

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
                    { key: 'permissions', label: 'Permissões', icon: Lock, color: 'orange' },
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
                        const companyOnlyTabs = ['financial', 'team', 'webhooks', 'permissions'];
                        if (companyOnlyTabs.includes(tab.key)) {
                            return false;
                        }
                    }

                    // Always show Admin tab to system admin if included above
                    if (tab.key === 'admin') return true;
                    if (isAdmin && tab.key === 'whatsapp') return true;
                    // Always show Permissions tab to Owner (or if access granted logic is complex, keep it simple: Owner sees all)
                    if (currentEntity.type === 'personal') return true;

                    const userRole = currentEntity.role || 'owner';

                    if (userRole === 'owner') return true;

                    const tabSettings = currentCompany?.settings?.settings_tabs?.[tab.key];
                    if (!tabSettings) {
                        // Default Behavior if not configured:
                        // Permissions: Owners only (so Members/Admins don't see it by default unless configured?)
                        // Actually, let's Stick to the Matrix defaults.
                        // If undefined, default to:
                        // Admin: TRUE for all except maybe Permissions?
                        // Member: FALSE for all?

                        if (tab.key === 'permissions') return false; // Default Permissions hidden

                        if (userRole === 'admin') return true; // Admins see others by default
                        return false; // Members see nothing by default
                    }

                    if (userRole === 'member' && tabSettings.member === false) return false;
                    if (userRole === 'admin' && tabSettings.admin === false) return false;

                    return true;
                }).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`pb-3 px-4 flex items-center gap-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key
                            ? `border-${tab.color}-600 text-${tab.color}-600 dark:text-${tab.color}-400`
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
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
                                    <RefreshCw size={16} className="mr-2" />
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
                                                        <span className={`px-2 py-0.5 rounded text-xs border capitalize ${m.role === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                                                            {m.role === 'owner' ? 'Dono' : m.role}
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

                {activeTab === 'permissions' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <ShieldAlert className="text-orange-600 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Permissões de Acesso</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Configure o que os membros da equipe podem ou não fazer.
                                </p>
                            </div>
                        </div>

                        {currentEntity.type !== 'company' ? (
                            <div className="text-center py-12 text-gray-500">
                                <Building size={48} className="mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-medium">Configuração disponível apenas para Empresas</h3>
                                <p>Selecione uma empresa no menu lateral para configurar permissões.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-medium text-gray-900 dark:text-white">Exclusão de Dados</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Permitir que membros com perfil "Member" excluam registros (Transações, Clientes, etc)?
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={memberCanDelete}
                                            onChange={async (e) => {
                                                const newValue = e.target.checked;
                                                setMemberCanDelete(newValue);
                                                // Auto-save setting
                                                try {
                                                    const currentCompany = companies.find(c => c.id === currentEntity.id);
                                                    await updateCompany(currentEntity.id!, {
                                                        settings: {
                                                            ...currentCompany?.settings,
                                                            member_can_delete: newValue
                                                        }
                                                    });
                                                } catch (err) {
                                                    alert("Erro ao salvar permissão.");
                                                    setMemberCanDelete(!newValue); // Rollback
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-medium text-gray-900 dark:text-white">Módulo Fiscal (TecnoSpeed)</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Habilitar emissão de Notas Fiscais Eletrônicas (NF-e/NFS-e)?
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={companies.find(c => c.id === currentEntity.id)?.fiscal_module_enabled ?? false}
                                            onChange={async (e) => {
                                                const newValue = e.target.checked;
                                                try {
                                                    await updateCompany(currentEntity.id!, {
                                                        fiscal_module_enabled: newValue
                                                    });
                                                    if (newValue) {
                                                        alert("Módulo Fiscal habilitado! Uma nova aba apareceu para configurações.");
                                                    }
                                                } catch (err) {
                                                    alert("Erro ao salvar configuração fiscal.");
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-medium text-gray-900 dark:text-white">Módulo de Pagamentos (Gateways)</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Habilitar integração com gateways de pagamento (Mercado Pago, Stripe, Asaas)?
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={companies.find(c => c.id === currentEntity.id)?.payments_module_enabled ?? false}
                                            onChange={async (e) => {
                                                const newValue = e.target.checked;
                                                try {
                                                    await updateCompany(currentEntity.id!, {
                                                        payments_module_enabled: newValue
                                                    });
                                                    if (newValue) {
                                                        alert("Módulo de Pagamentos habilitado! Uma nova aba apareceu para configurações.");
                                                    }
                                                } catch (err) {
                                                    alert("Erro ao salvar configuração de pagamentos.");
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-base font-medium text-gray-900 dark:text-white">Matriz de Acesso aos Módulos</h4>
                                            <p className="text-sm text-gray-500">Defina com precisão quem pode acessar cada área do sistema.</p>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white w-1/3">Módulo</th>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white text-center w-1/3">
                                                        <div className="flex flex-col items-center">
                                                            <span>Admin</span>
                                                            <span className="text-[10px] font-normal text-gray-500">Acesso Total (Padrão)</span>
                                                        </div>
                                                    </th>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white text-center w-1/3">
                                                        <div className="flex flex-col items-center">
                                                            <span>Membro</span>
                                                            <span className="text-[10px] font-normal text-gray-500">Acesso Limitado</span>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                                {APP_MODULES.map((module) => {
                                                    const currentCompany = companies.find(c => c.id === currentEntity.id);
                                                    const settings = currentCompany?.settings || {};
                                                    const modules = settings.modules || {};

                                                    const adminEnabled = getModulePermission(module.key, 'admin', settings);
                                                    const memberEnabled = getModulePermission(module.key, 'member', settings);

                                                    const togglePermission = async (role: 'admin' | 'member', value: boolean) => {
                                                        try {
                                                            await updateCompany(currentEntity.id!, {
                                                                settings: {
                                                                    ...settings,
                                                                    modules: {
                                                                        ...modules,
                                                                        [module.key]: {
                                                                            ...modules[module.key],
                                                                            [role]: value
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        } catch (err) {
                                                            alert("Erro ao atualizar permissão.");
                                                        }
                                                    };

                                                    return (
                                                        <tr key={module.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                            <td className="px-4 py-3">
                                                                <span className="font-medium text-gray-900 dark:text-white block">{module.label}</span>
                                                                <span className="text-xs text-gray-500 hidden md:block">{module.desc}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={adminEnabled}
                                                                            onChange={(e) => togglePermission('admin', e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={memberEnabled}
                                                                            onChange={(e) => togglePermission('member', e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-base font-medium text-gray-900 dark:text-white">Matriz de Acesso: Abas de Configuração</h4>
                                            <p className="text-sm text-gray-500">Controle quais abas aparecem dentro da tela de Configurações.</p>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white w-1/3">Aba</th>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white text-center w-1/3">
                                                        <div className="flex flex-col items-center">
                                                            <span>Admin</span>
                                                        </div>
                                                    </th>
                                                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-white text-center w-1/3">
                                                        <div className="flex flex-col items-center">
                                                            <span>Membro</span>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                                {SETTINGS_TABS.map((tab) => {
                                                    const currentCompany = companies.find(c => c.id === currentEntity.id);
                                                    const settings = currentCompany?.settings || {};

                                                    const adminEnabled = getTabPermission(tab.key, 'admin', settings);
                                                    const memberEnabled = getTabPermission(tab.key, 'member', settings);

                                                    const toggleTabPermission = async (role: 'admin' | 'member', value: boolean) => {
                                                        try {
                                                            const settingsTabs = settings.settings_tabs || {};
                                                            await updateCompany(currentEntity.id!, {
                                                                settings: {
                                                                    ...settings,
                                                                    settings_tabs: {
                                                                        ...settingsTabs,
                                                                        [tab.key]: {
                                                                            ...settingsTabs[tab.key],
                                                                            [role]: value
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        } catch (err) {
                                                            alert("Erro ao atualizar permissão da aba.");
                                                        }
                                                    };

                                                    return (
                                                        <tr key={tab.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                            <td className="px-4 py-3">
                                                                <span className="font-medium text-gray-900 dark:text-white block">{tab.label}</span>
                                                                <span className="text-xs text-gray-500 hidden md:block">{tab.desc}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={adminEnabled}
                                                                            onChange={(e) => toggleTabPermission('admin', e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={memberEnabled}
                                                                            onChange={(e) => toggleTabPermission('member', e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
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
                                    <span className="text-sm font-medium">Receita Total</span>
                                    <DollarSign size={20} />
                                </div>
                                <div className="text-3xl font-bold">
                                    {adminLoading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.total_revenue || 0)}
                                </div>
                                <div className="text-xs mt-2 opacity-80">
                                    Volume transacionado (Pago/Recebido)
                                </div>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Movimento de Usuários</h3>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => refreshAdmin()} isLoading={adminLoading}>
                                        <RefreshCw size={16} className={adminLoading ? 'animate-spin' : ''} />
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Usuário / Email</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Limite</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Transações</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Status</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Cadastrado em</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                        {adminLoading ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                                    Carregando dados...
                                                </td>
                                            </tr>
                                        ) : usersList.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                                    Nenhum usuário encontrado.
                                                </td>
                                            </tr>
                                        ) : (
                                            usersList.map((u) => {
                                                const isOnline = onlineUsers.includes(u.id);
                                                const isBanned = u.banned_until && new Date(u.banned_until) > new Date();

                                                return (
                                                    <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all ${isBanned ? 'bg-gray-100 dark:bg-slate-800/50 opacity-75' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-full ${isBanned ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                    {isBanned ? <Lock size={20} /> : <Users size={20} />}
                                                                </div>
                                                                <div>
                                                                    <div className={`font-medium flex items-center gap-2 ${isBanned ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                                        {u.full_name || 'Sem nome'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">{u.email}</div>
                                                                </div>

                                                                {isOnline && !isBanned && (
                                                                    <span
                                                                        className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse border-2 border-white dark:border-slate-800 ml-auto"
                                                                        title="Online agora"
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                            <span className={`px-2 py-0.5 rounded text-xs border ${u.user_type === 'PJ' ? 'border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800' : 'border-gray-200 bg-gray-50'}`}>
                                                                {u.user_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="font-medium text-gray-900 dark:text-white">{u.max_companies ?? 1}</span>
                                                                <button
                                                                    onClick={async () => {
                                                                        const newLimit = prompt(`Novo limite de empresas para ${u.full_name}:`, (u.max_companies ?? 1).toString());
                                                                        if (newLimit && !isNaN(parseInt(newLimit))) {
                                                                            const { error } = await updateUserLimit(u.id, parseInt(newLimit));
                                                                            if (error) alert('Erro ao atualizar limite: ' + error);
                                                                        }
                                                                    }}
                                                                    className="text-blue-500 hover:text-blue-700 p-1"
                                                                    title="Alterar Limite"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-medium">
                                                            {u.quotes_count}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-medium">
                                                            {u.transactions_count}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center">
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={!isBanned}
                                                                        onChange={async (e) => {
                                                                            const shouldBan = !e.target.checked;
                                                                            const action = shouldBan ? 'BLOQUEAR' : 'DESBLOQUEAR';

                                                                            const { error } = await toggleUserBan(u.id, shouldBan);
                                                                            if (error) {
                                                                                // Revert physically if needed, but since we rely on prop, just alert error
                                                                                alert(`Erro ao ${action.toLowerCase()}: ` + error);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="w-11 h-6 bg-red-500 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                                                    <span className={`ml-3 text-sm font-bold w-20 text-left ${isBanned ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                                        {isBanned ? 'Bloqueado' : 'Ativo'}
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-500">
                                                            {new Date(u.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`Tem certeza que deseja EXCLUIR o usuário ${u.full_name}? Essa ação não pode ser desfeita e apagará todos os dados dele.`)) {
                                                                        const { error } = await deleteUser(u.id);
                                                                        if (error) alert('Erro ao excluir: ' + error);
                                                                        else alert('Usuário excluído com sucesso.');
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-700 transition-colors p-1"
                                                                title="Excluir Usuário"
                                                            >
                                                                <Trash2 size={18} />
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

                        {/* Companies Management Table */}
                        <div className="pt-8 border-t border-gray-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestão de Empresas</h3>
                                    <p className="text-sm text-gray-500">Controle os módulos ativos e visualize detalhes de todas as empresas do sistema.</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Logo / Empresa</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Responsável (Dono)</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Time</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Fiscal</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Pagamentos</th>
                                            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Cadastrada em</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                        {adminLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                                    Carregando empresas...
                                                </td>
                                            </tr>
                                        ) : companiesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                                    Nenhuma empresa cadastrada.
                                                </td>
                                            </tr>
                                        ) : (
                                            companiesList.map((c) => (
                                                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all text-gray-700 dark:text-gray-200">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            {c.logo_url ? (
                                                                <img src={c.logo_url} alt="" className="w-10 h-10 object-contain rounded bg-white p-1 border border-gray-100" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                                                    {c.trade_name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="font-bold">{c.trade_name}</div>
                                                                <div className="text-[10px] text-gray-500 font-mono">{c.cnpj}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{c.owner_name || 'Desconhecido'}</div>
                                                        <div className="text-xs text-gray-500">{c.owner_email}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Users size={14} className="text-gray-400" />
                                                            <span className="font-bold">{c.members_count}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={c.fiscal_module_enabled}
                                                                    onChange={async (e) => {
                                                                        const { error } = await updateCompanyConfig(c.id, e.target.checked, c.payments_module_enabled);
                                                                        if (error) alert('Erro: ' + error);
                                                                    }}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={c.payments_module_enabled}
                                                                    onChange={async (e) => {
                                                                        const { error } = await updateCompanyConfig(c.id, c.fiscal_module_enabled, e.target.checked);
                                                                        if (error) alert('Erro: ' + error);
                                                                    }}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-500">
                                                        {new Date(c.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </div >
    );
}
