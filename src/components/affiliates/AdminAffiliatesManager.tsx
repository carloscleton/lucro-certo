import { useState } from 'react';
import { useAdminAffiliates } from '../../hooks/useAdminAffiliates';
import { 
    Users, 
    Wallet, 
    Edit2, 
    Search, 
    DollarSign, 
    Loader2
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function AdminAffiliatesManager() {
    const { affiliates, payoutsQueue, totalRequestedPayouts, totalCompletedPayouts, loading, updateRules, processPayout } = useAdminAffiliates();
    const [tab, setTab] = useState<'affiliates' | 'payouts'>('affiliates');
    const [search, setSearch] = useState('');
    
    // Modal de Edição de Regras
    const [editingAffiliate, setEditingAffiliate] = useState<any>(null);
    const [rewardType, setRewardType] = useState<'percentage' | 'fixed' | 'credit_only'>('percentage');
    const [rewardValue, setRewardValue] = useState<number>(15);
    const [recurringMode, setRecurringMode] = useState<'lifetime' | 'first_payment' | 'limited_months'>('lifetime');
    const [limitedMonths, setLimitedMonths] = useState<number>(6);
    const [holdingDays, setHoldingDays] = useState<number>(15);
    const [status, setStatus] = useState<'active' | 'suspended'>('active');
    const [pixKey, setPixKey] = useState<string>('');
    const [pixKeyType, setPixKeyType] = useState<string>('cpf');
    const [isSaving, setIsSaving] = useState(false);

    // Modal de Processar Saque
    const [processingPayout, setProcessingPayout] = useState<any>(null);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    const openEditModal = (aff: any) => {
        setEditingAffiliate(aff);
        setRewardType(aff.reward_type || 'percentage');
        setRewardValue(aff.reward_value || 15);
        setRecurringMode(aff.recurring_mode || 'lifetime');
        setLimitedMonths(aff.limited_months || 6);
        setHoldingDays(aff.holding_days || 15);
        setStatus(aff.status || 'active');
        setPixKey(aff.pix_key || '');
        setPixKeyType(aff.pix_key_type || 'cpf');
    };

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAffiliate) return;
        try {
            setIsSaving(true);
            await updateRules(editingAffiliate.id, {
                reward_type: rewardType,
                reward_value: rewardValue,
                recurring_mode: recurringMode,
                limited_months: recurringMode === 'limited_months' ? limitedMonths : undefined,
                holding_days: holdingDays,
                status,
                pix_key: pixKey,
                pix_key_type: pixKeyType
            });
            setEditingAffiliate(null);
        } finally {
            setIsSaving(false);
        }
    };

    const handleProcessPayoutAction = async (actionStatus: 'completed' | 'rejected') => {
        if (!processingPayout) return;
        try {
            setIsProcessingAction(true);
            await processPayout(processingPayout.id, actionStatus, receiptUrl, notes);
            setProcessingPayout(null);
            setReceiptUrl('');
            setNotes('');
        } finally {
            setIsProcessingAction(false);
        }
    };

    const formatBRL = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const filteredAffiliates = affiliates.filter(a => {
        const q = search.toLowerCase();
        const name = a.profile?.full_name || a.company?.trade_name || '';
        const code = a.code || '';
        return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Loader2 className="animate-spin text-purple-600" size={32} />
                <span className="text-xs text-gray-500 font-medium">Carregando Gestão do Dono do Sistema...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            
            {/* Header Metrics para o Dono do Sistema */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                        <span>Total de Afiliados</span>
                        <Users size={18} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        {affiliates.length}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-amber-100 dark:border-amber-950/40 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                        <span>Saques Solicitados (Aguardando Pix)</span>
                        <Wallet size={18} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                        {formatBRL(totalRequestedPayouts)}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-950/40 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <span>Total Já Pago em Comissões</span>
                        <DollarSign size={18} className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                        {formatBRL(totalCompletedPayouts)}
                    </div>
                </div>
            </div>

            {/* Abas da Gestão */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTab('affiliates')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                tab === 'affiliates'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            Afiliados Cadastrados ({affiliates.length})
                        </button>
                        <button
                            onClick={() => setTab('payouts')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                                tab === 'payouts'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            Fila de Saques Pix ({payoutsQueue.filter(p => p.status === 'requested').length})
                        </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nome ou cupom..."
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                {tab === 'affiliates' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-gray-500 font-bold border-b border-gray-100 dark:border-slate-700/60">
                                <tr>
                                    <th className="py-3.5 px-4">Afiliado / Empresa</th>
                                    <th className="py-3.5 px-4">Código / Cupom</th>
                                    <th className="py-3.5 px-4">Regra de Comissão</th>
                                    <th className="py-3.5 px-4">Duração</th>
                                    <th className="py-3.5 px-4">Trava</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-700 dark:text-gray-200">
                                {filteredAffiliates.map((aff: any) => (
                                    <tr key={aff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                         <td className="py-3.5 px-4">
                                             <div className="font-bold text-gray-900 dark:text-white">
                                                 {aff.profile?.full_name || aff.company?.trade_name || 'Afiliado'}
                                             </div>
                                             <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-2 mt-0.5">
                                                 <span>{aff.profile?.email}</span>
                                                 {aff.pix_key && (
                                                     <span className="font-mono text-[9px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                                                         PIX ({aff.pix_key_type?.toUpperCase()}): {aff.pix_key}
                                                     </span>
                                                 )}
                                             </div>
                                         </td>
                                        <td className="py-3.5 px-4">
                                            <span className="font-mono font-bold px-2 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-600 rounded border border-purple-100">
                                                {aff.code}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-bold">
                                            {aff.reward_type === 'fixed'
                                                ? formatBRL(aff.reward_value)
                                                : `${aff.reward_value}%`}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {aff.recurring_mode === 'lifetime'
                                                ? 'Vitalício'
                                                : aff.recurring_mode === 'first_payment'
                                                ? '1ª Mensalidade'
                                                : `Primeiros ${aff.limited_months} meses`}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono">
                                            {aff.holding_days || 15} dias
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                aff.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {aff.status === 'active' ? 'Ativo' : 'Suspenso'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(aff)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-purple-600 font-bold transition-colors"
                                                title="Configurar Regras do Afiliado"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-gray-500 font-bold border-b border-gray-100 dark:border-slate-700/60">
                                <tr>
                                    <th className="py-3.5 px-4">Data Solicitada</th>
                                    <th className="py-3.5 px-4">Afiliado</th>
                                    <th className="py-3.5 px-4">Chave PIX</th>
                                    <th className="py-3.5 px-4">Valor</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                                {payoutsQueue.map((payout: any) => (
                                    <tr key={payout.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                        <td className="py-3.5 px-4 font-mono text-gray-500">
                                            {new Date(payout.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {payout.affiliate?.profile?.full_name || payout.affiliate?.company?.trade_name}
                                            </div>
                                            <div className="text-[11px] text-gray-400">Cupom: {payout.affiliate?.code}</div>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                                            {payout.pix_key_used || payout.affiliate?.pix_key || 'Não informada'}
                                        </td>
                                        <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                                            {formatBRL(payout.amount)}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                payout.status === 'requested'
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : payout.status === 'completed'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {payout.status === 'requested' ? 'Pendente' : payout.status === 'completed' ? 'Pago' : 'Rejeitado'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            {payout.status === 'requested' ? (
                                                <button
                                                    onClick={() => setProcessingPayout(payout)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                                                >
                                                    Pagar / Processar
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 font-mono text-[11px]">Processado</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Editar Regras de Afiliado (Super Admin) */}
            <Modal isOpen={!!editingAffiliate} onClose={() => setEditingAffiliate(null)} title="Configurar Regras do Afiliado" icon={Edit2}>
                <form onSubmit={handleSaveRules} className="space-y-4 pt-2">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-xs text-purple-800 dark:text-purple-300 font-semibold">
                        Afiliado: <strong>{editingAffiliate?.profile?.full_name || editingAffiliate?.company?.trade_name}</strong> (Código: {editingAffiliate?.code})
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Tipo de Recompensa</label>
                            <select
                                value={rewardType}
                                onChange={e => setRewardType(e.target.value as any)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            >
                                <option value="percentage">Percentual (%)</option>
                                <option value="fixed">Valor Fixo em Reais (R$)</option>
                                <option value="credit_only">Apenas Desconto na Fatura</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {rewardType === 'percentage' ? 'Percentual (%)' : 'Valor Fixo (R$)'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={rewardValue}
                                onChange={e => setRewardValue(parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Recorrência</label>
                            <select
                                value={recurringMode}
                                onChange={e => setRecurringMode(e.target.value as any)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            >
                                <option value="lifetime">Vitalício (Todas as faturas)</option>
                                <option value="first_payment">Apenas 1ª Mensalidade</option>
                                <option value="limited_months">Limitado a N meses</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Dias de Trava / Maturação</label>
                            <input
                                type="number"
                                value={holdingDays}
                                onChange={e => setHoldingDays(parseInt(e.target.value) || 15)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Tipo de Chave PIX</label>
                            <select
                                value={pixKeyType}
                                onChange={e => setPixKeyType(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            >
                                <option value="cpf">CPF</option>
                                <option value="cnpj">CNPJ</option>
                                <option value="email">E-mail</option>
                                <option value="phone">Telefone</option>
                                <option value="random">Chave Aleatória</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Chave PIX</label>
                            <input
                                type="text"
                                value={pixKey}
                                onChange={e => setPixKey(e.target.value)}
                                placeholder="Chave do Afiliado..."
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Status do Afiliado</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value as any)}
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold mt-1"
                        >
                            <option value="active">Ativo</option>
                            <option value="suspended">Suspenso / Bloqueado</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setEditingAffiliate(null)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving} className="bg-purple-600 text-white font-bold">
                            Salvar Configuração
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Processar Saque Pix */}
            <Modal isOpen={!!processingPayout} onClose={() => setProcessingPayout(null)} title="Aprovar e Confirmar Pagamento Pix" icon={Wallet}>
                <div className="space-y-4 pt-2">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 text-xs space-y-1">
                        <div className="font-bold text-emerald-900 dark:text-emerald-300">Dados da Transferência Pix:</div>
                        <div>Afiliado: <strong>{processingPayout?.affiliate?.profile?.full_name || processingPayout?.affiliate?.company?.trade_name}</strong></div>
                        <div>Chave PIX: <strong className="font-mono text-emerald-600">{processingPayout?.pix_key_used || processingPayout?.affiliate?.pix_key}</strong></div>
                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 pt-1">
                            Valor: {formatBRL(processingPayout?.amount)}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Link do Comprovante Pix (Opcional)</label>
                        <input
                            type="text"
                            value={receiptUrl}
                            onChange={e => setReceiptUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <Button
                            type="button"
                            variant="danger"
                            disabled={isProcessingAction}
                            onClick={() => handleProcessPayoutAction('rejected')}
                        >
                            Rejeitar Saque
                        </Button>
                        <Button
                            type="button"
                            disabled={isProcessingAction}
                            onClick={() => handleProcessPayoutAction('completed')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            Confirmar Pagamento Realizado
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
