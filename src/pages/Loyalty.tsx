import { useState } from 'react';
import { Award, Plus, Users, CreditCard, Settings, BarChart3, Package, TrendingUp, AlertTriangle, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { useLoyalty } from '../hooks/useLoyalty';
import { PlanForm, PlanList } from '../components/loyalty/PlanCRUD';
import { LoyaltySettings } from '../components/loyalty/LoyaltySettings';
import { SubscriberList, ChargeHistory } from '../components/loyalty/LoyaltyLists';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ResultModal } from '../components/ui/ResultModal';
import { useEntity } from '../context/EntityContext';

export function Loyalty() {
  const { t } = useTranslation();
  const { currentEntity } = useEntity();
  const { plans, settings, stats, loading, addPlan, updatePlan, deletePlan, updateSettings } = useLoyalty();
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'subscribers' | 'charges' | 'settings'>('overview');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/clube/${currentEntity.slug || ''}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Modal States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
    isOpen: false, title: '', message: '', type: 'success'
  });


  const tabs = [
    { id: 'overview', label: t('loyalty.tab_overview', 'Visão Geral'), icon: BarChart3 },
    { id: 'plans', label: t('loyalty.tab_plans', 'Meus Planos'), icon: Package },
    { id: 'subscribers', label: t('loyalty.tab_subscribers', 'Assinantes'), icon: Users },
    { id: 'charges', label: t('loyalty.tab_charges', 'Cobranças'), icon: CreditCard },
    { id: 'settings', label: t('loyalty.tab_settings', 'Configurações'), icon: Settings },
  ] as const;

  const handleOpenPlanModal = (plan?: any) => {
    setEditingPlan(plan || null);
    setIsPlanModalOpen(true);
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="text-amber-500" />
            {t('loyalty.title', 'Clube de Fidelidade')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{t('loyalty.subtitle', 'Planos de recorrência e benefícios para seus clientes')}</p>
        </div>
        {activeTab === 'plans' && (
             <Button onClick={() => handleOpenPlanModal()} className="bg-amber-600 hover:bg-amber-700">
                <Plus size={20} className="mr-2" />
                {t('loyalty.new_plan', 'Novo Plano')}
            </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-lg shadow-amber-500/10'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-8">
        {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Subscribers Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{t('loyalty.active_subscribers', 'Assinantes Ativos')}</p>
                            <h3 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                                {String(stats.activeSubscribers).padStart(2, '0')}
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
                        <span className="text-gray-500">{t('loyalty.trialing_subscribers', 'Em período de teste')}:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                            {stats.trialingCount || 0}
                        </span>
                    </div>
                </div>

                {/* MRR Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{t('loyalty.monthly_revenue', 'MRR (Recorrência Mensal)')}</p>
                            <h3 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(stats.mrr)}
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                            <CreditCard size={24} />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Receita previsível</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Ativo
                        </span>
                    </div>
                </div>

                {/* Overdue Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{t('loyalty.pending_charges', 'Inadimplentes')}</p>
                            <h3 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                                {String(stats.overdueCount).padStart(2, '0')}
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Cancelamentos:</span>
                        <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 rounded-full">
                            {stats.canceledCount || 0}
                        </span>
                    </div>
                </div>

                {/* Promotional banner OR Dashboard Share & shortcut panels */}
                {plans.length === 0 ? (
                    <div className="md:col-span-3 bg-white dark:bg-slate-800 rounded-3xl p-12 border border-blue-100 dark:border-blue-900/30 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mb-6">
                            <Award className="text-blue-600" size={32} />
                        </div>
                        <h4 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">{t('loyalty.power_of_recurrence', 'O poder da recorrência')}</h4>
                        <p className="text-gray-500 dark:text-gray-400 max-w-xl text-center leading-relaxed">
                            {t('loyalty.recurrence_desc', 'Crie planos de fidelidade para garantir receita mensal previsível. Ofereça descontos exclusivos nos serviços para seus melhores clientes.')}
                        </p>
                        <div className="mt-8 flex gap-4">
                            <Button onClick={() => setActiveTab('plans')} variant="outline" className="rounded-xl px-8 py-3">{t('loyalty.view_plans', 'Ver meus planos')}</Button>
                            <Button onClick={() => setActiveTab('settings')} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl px-8 py-3 shadow-xl">{t('loyalty.config_gateway', 'Configurar Gateway')}</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Public Link Share Section */}
                        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                                    <Award size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Divulgue seu Clube de Fidelidade</h4>
                                    <p className="text-sm text-gray-500">Compartilhe o link ou utilize o QR Code nos seus canais de atendimento e redes sociais.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Link Input Row */}
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            readOnly
                                            value={currentEntity.slug ? `${window.location.origin}/clube/${currentEntity.slug}` : 'URL indisponível (Slug não configurado)'}
                                            className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 focus:outline-none"
                                        />
                                        <button
                                            onClick={handleCopyLink}
                                            disabled={!currentEntity.slug}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors"
                                            title="Copiar Link"
                                        >
                                            {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                    {currentEntity.slug && (
                                        <a
                                            href={`/clube/${currentEntity.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-2xl transition-all"
                                            title="Acessar Página Pública"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    )}
                                </div>

                                {/* QR Code / Share Guide */}
                                {currentEntity.slug ? (
                                    <div className="flex flex-col sm:flex-row gap-6 p-6 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 items-center">
                                        <div className="w-24 h-24 bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-center text-gray-900 shrink-0 shadow-sm relative group">
                                            <QrCode size={80} className="text-slate-800" />
                                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                                                <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold">Imprimir QR</span>
                                            </div>
                                        </div>
                                        <div className="text-center sm:text-left space-y-2">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Como atrair mais assinantes?</p>
                                            <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside text-left">
                                                <li>Adicione o link na biografia do seu Instagram ou Facebook.</li>
                                                <li>Envie mensagens personalizadas para seus clientes mais frequentes.</li>
                                                <li>Imprima o QR Code e coloque no balcão de atendimento ou mesas.</li>
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-xs rounded-2xl flex items-center gap-2">
                                        <AlertTriangle size={16} />
                                        <span>Para ativar o link público e o QR Code, configure a <strong>URL Amigável (Slug)</strong> nas configurações da empresa.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plan Shortcuts Column */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Seus Planos</h4>
                                    <span className="text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">
                                        {plans.length} {plans.length === 1 ? 'plano' : 'planos'}
                                    </span>
                                </div>
                                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                                    {plans.map((plan) => (
                                        <div key={plan.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-gray-100/50 dark:border-slate-700/50">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: plan.color || '#f59e0b' }}></span>
                                                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{plan.name}</p>
                                            </div>
                                            <span className="text-xs font-black text-gray-900 dark:text-white shrink-0">
                                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(plan.price)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-6">
                                <Button onClick={() => setActiveTab('plans')} className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-2xl py-3 text-xs font-bold">
                                    Gerenciar Planos
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {activeTab === 'plans' && (
            <PlanList 
                plans={plans} 
                onEdit={handleOpenPlanModal} 
                onDelete={(id) => {
                    setPlanToDelete(id);
                    setDeleteConfirmOpen(true);
                }} 
            />
        )}

        {activeTab === 'settings' && settings && (
            <LoyaltySettings 
                settings={settings} 
                onUpdate={updateSettings} 
            />
        )}

        {activeTab === 'subscribers' && (
            <SubscriberList />
        )}

        {activeTab === 'charges' && (
            <ChargeHistory />
        )}
      </div>

      <PlanForm 
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        initialData={editingPlan}
        onSubmit={editingPlan ? (data) => updatePlan(editingPlan.id, data) : addPlan}
      />

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
            if (!planToDelete) return;
            try {
                await deletePlan(planToDelete);
                setDeleteConfirmOpen(false);
                setPlanToDelete(null);
                setResultModal({
                    isOpen: true,
                    title: t('common.success') || 'Sucesso',
                    message: 'Plano removido com sucesso.',
                    type: 'success'
                });
            } catch (error: any) {
                setResultModal({
                    isOpen: true,
                    title: t('common.error') || 'Erro',
                    message: error.message || 'Erro ao excluir plano',
                    type: 'error'
                });
            }
        }}
        title={t('loyalty.confirm_delete_plan', 'Excluir Plano')}
        message="Tem certeza que deseja excluir este plano? Novos assinantes não poderão aderir a ele, mas assinaturas existentes continuarão ativas."
        variant="danger"
        confirmLabel="Sim, Excluir"
      />

      <ResultModal
        isOpen={resultModal.isOpen}
        onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
        title={resultModal.title}
        message={resultModal.message}
        type={resultModal.type}
      />
    </div>
  );
}
