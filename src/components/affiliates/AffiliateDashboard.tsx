import { useState, useEffect } from 'react';
import { useAffiliates } from '../../hooks/useAffiliates';
import { PayoutRequestModal } from './PayoutRequestModal';
import { ShareWhatsAppModal } from './ShareWhatsAppModal';
import { 
    Gift, 
    Copy, 
    Check, 
    Users, 
    Wallet, 
    Clock, 
    ArrowUpRight, 
    Sparkles, 
    ShieldCheck, 
    TrendingUp,
    MessageSquare,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { Button } from '../ui/Button';

export function AffiliateDashboard() {
    const { affiliate, stats, loading, referralLink, requestPayout, updatePixKey } = useAffiliates();
    const [copied, setCopied] = useState(false);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

    // States for PIX registration
    const [pixType, setPixType] = useState('cpf');
    const [pixKey, setPixKey] = useState('');
    const [savingPix, setSavingPix] = useState(false);
    const [pixStatus, setPixStatus] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (affiliate) {
            setPixType(affiliate.pix_key_type || 'cpf');
            setPixKey(affiliate.pix_key || '');
        }
    }, [affiliate]);

    const handleSavePix = async () => {
        if (!pixKey.trim()) {
            setPixStatus({ success: false, message: 'Digite uma chave PIX antes de salvar.' });
            return;
        }

        try {
            setSavingPix(true);
            setPixStatus(null);
            const ok = await updatePixKey(pixKey, pixType);
            if (ok) {
                setPixStatus({ success: true, message: 'Chave PIX salva com sucesso!' });
                setTimeout(() => setPixStatus(null), 3000);
            } else {
                setPixStatus({ success: false, message: 'Falha ao atualizar a chave PIX.' });
            }
        } catch (err: any) {
            setPixStatus({ success: false, message: err.message || 'Erro ao processar.' });
        } finally {
            setSavingPix(false);
        }
    };

    const handleCopyLink = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const formatBRL = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="text-xs text-gray-500 font-medium">Carregando seu Painel de Afiliado...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-xl">
                <div className="absolute right-0 top-0 opacity-10 translate-x-10 -translate-y-10 pointer-events-none">
                    <Gift size={320} />
                </div>

                <div className="relative z-10 space-y-4 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold border border-white/20 text-white" style={{ color: '#ffffff' }}>
                        <Sparkles size={14} className="text-amber-300 animate-pulse" />
                        Programa Indique e Ganhe Lucro Certo
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-white" style={{ color: '#ffffff' }}>
                        Indique parceiros e ganhe comissão por cada mensalidade!
                    </h1>

                    {/* Copiar Link & WhatsApp Box */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 flex items-center bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl p-1.5 pl-3">
                            <span className="text-xs text-white/90 font-mono truncate select-all">
                                {referralLink || 'Gerando seu link...'}
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="ml-auto px-4 py-2 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all shrink-0 active:scale-95"
                            >
                                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                {copied ? 'Copiado!' : 'Copiar Link'}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsWhatsAppModalOpen(true)}
                            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 active:scale-95"
                        >
                            <MessageSquare size={16} />
                            WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            {/* 4 Cards Financeiros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Saldo Disponível */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-950/40 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Saldo Disponível</span>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {formatBRL(stats.availableBalance)}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Liberado para resgate via Pix</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                        <Button
                            size="sm"
                            disabled={stats.availableBalance <= 0}
                            onClick={() => setIsPayoutModalOpen(true)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                        >
                            <ArrowUpRight size={14} />
                            Solicitar Saque Pix
                        </Button>
                    </div>
                </div>

                {/* 2. Saldo em Maturação */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-amber-100 dark:border-amber-950/40 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Em Maturação</span>
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {formatBRL(stats.pendingBalance)}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Libera após {affiliate?.holding_days || 15} dias de trava</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60 text-[11px] text-gray-500 font-semibold flex items-center justify-between">
                        <span>Trava de Segurança</span>
                        <ShieldCheck size={14} className="text-amber-500" />
                    </div>
                </div>

                {/* 3. Indicados Totais */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-blue-100 dark:border-blue-950/40 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Total de Indicados</span>
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            <Users size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                            {stats.totalReferralsCount}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Empresas cadastradas pelo seu link</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60 text-[11px] text-gray-500 font-semibold flex items-center justify-between">
                        <span>Conversão direta</span>
                        <TrendingUp size={14} className="text-blue-500" />
                    </div>
                </div>

                {/* 4. Total Já Sacado */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-purple-100 dark:border-purple-950/40 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Já Sacado</span>
                        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                            <Gift size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                            {formatBRL(stats.totalPaidOut)}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Transferidos para sua conta Pix</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60 text-[11px] text-gray-500 font-semibold flex items-center justify-between">
                        <span>Histórico acumulado</span>
                        <Check size={14} className="text-purple-500" />
                    </div>
                </div>

            </div>

            {/* Seção Principal: Indicados + Dados Pix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Tabela de Indicados e Extrato */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/60 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">Seus Clientes Indicados</h3>
                                <p className="text-xs text-gray-500">Acompanhe quem se cadastrou pelo seu código e o status de cada comissão</p>
                            </div>
                            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700/80 rounded-full text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                                Seu Cupom: {affiliate?.code}
                            </div>
                        </div>

                        {stats.referrals.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                                    <Users size={24} />
                                </div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Nenhum indicado ainda</h4>
                                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                    Copie seu link de indicação acima e envie para seus amigos empresários ou contadores!
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-gray-500 font-bold border-b border-gray-100 dark:border-slate-700/60">
                                        <tr>
                                            <th className="py-3.5 px-4">Empresa / Cliente</th>
                                            <th className="py-3.5 px-4">Data Cadastro</th>
                                            <th className="py-3.5 px-4">Sua Comissão</th>
                                            <th className="py-3.5 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-700 dark:text-gray-200">
                                        {stats.referrals.map((ref: any) => {
                                            const name = ref.referred_company?.trade_name || ref.referred_profile?.full_name || 'Nova Empresa';
                                            const dateStr = new Date(ref.created_at).toLocaleDateString('pt-BR');
                                            const statusStr = ref.status === 'active' ? '🟢 Ativo (Em dia)' : '🔴 Inativo';

                                            return (
                                                <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                                                        {name}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-gray-500">
                                                        {dateStr}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-blue-600 dark:text-blue-400">
                                                        {affiliate?.reward_type === 'fixed'
                                                            ? formatBRL(affiliate.reward_value)
                                                            : `${affiliate?.reward_value || 15}% por fatura`}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                            ref.status === 'active'
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                                                        }`}>
                                                            {statusStr}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card Configuração Chave Pix */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/60 shadow-sm p-6 flex flex-col justify-between gap-6 h-fit">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100 dark:border-slate-700/60">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white font-sans">Sua Chave PIX</h3>
                                <p className="text-[10px] text-gray-400">Configure para receber transferências automáticas.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo de Chave</label>
                                <div className="grid grid-cols-3 gap-1">
                                    {['cpf', 'cnpj', 'email', 'phone', 'random'].map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setPixType(t)}
                                            className={`py-2 px-1 text-[10px] font-bold rounded-xl border uppercase transition-all duration-200 ${
                                                pixType === t
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            {t === 'phone' ? 'Tel' : t === 'random' ? 'Aleatória' : t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chave PIX Cadastrada</label>
                                <input
                                    type="text"
                                    value={pixKey}
                                    onChange={e => setPixKey(e.target.value)}
                                    placeholder="Informe sua chave PIX..."
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-250 dark:border-slate-700 rounded-xl p-3 text-xs text-gray-950 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold transition-all"
                                />
                            </div>
                        </div>

                        {pixStatus && (
                            <div className={`p-3.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 border animate-in fade-in duration-200 ${
                                pixStatus.success
                                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-450 border-rose-200'
                            }`}>
                                {pixStatus.success ? <Check size={14} /> : <AlertCircle size={14} />}
                                <span>{pixStatus.message}</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700/60">
                        <Button
                            onClick={handleSavePix}
                            isLoading={savingPix}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-11 rounded-xl shadow-sm transition-all duration-200"
                        >
                            Salvar Dados Pix
                        </Button>
                    </div>
                </div>

            </div>

            {/* Modal de Solicitação de Saque */}
            <PayoutRequestModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                availableBalance={stats.availableBalance}
                currentPixKey={affiliate?.pix_key}
                currentPixType={affiliate?.pix_key_type}
                onRequestPayout={requestPayout}
            />

            {/* Modal de Compartilhamento WhatsApp */}
            <ShareWhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                referralLink={referralLink}
            />
        </div>
    );
}
