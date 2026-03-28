import { useState } from 'react';
import { Award, Plus, Users, CreditCard, Settings, BarChart3, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { useLoyalty } from '../hooks/useLoyalty';
import { PlanForm, PlanList } from '../components/loyalty/PlanCRUD';
import { LoyaltySettings } from '../components/loyalty/LoyaltySettings';
import { SubscriberList, ChargeHistory } from '../components/loyalty/LoyaltyLists';

export function Loyalty() {
  const { t } = useTranslation();
  const { plans, settings, stats, loading, addPlan, updatePlan, deletePlan, updateSettings } = useLoyalty();
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'subscribers' | 'charges' | 'settings'>('overview');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);


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
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-8 text-white shadow-xl shadow-amber-500/20">
                    <TrendingUp className="mb-4 opacity-50" size={32} />
                    <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">{t('loyalty.active_subscribers', 'Assinantes Ativos')}</p>
                    <h3 className="text-4xl font-black italic tracking-tighter">
                        {String(stats.activeSubscribers).padStart(2, '0')}
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <CreditCard className="mb-4 text-emerald-500" size={32} />
                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{t('loyalty.monthly_revenue', 'MRR (Recorrência Mensal)')}</p>
                    <h3 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mrr)}
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <AlertTriangle className="mb-4 text-red-500" size={32} />
                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{t('loyalty.pending_charges', 'Inadimplentes')}</p>
                    <h3 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">
                        {String(stats.overdueCount).padStart(2, '0')}
                    </h3>
                </div>

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
            </div>
        )}

        {activeTab === 'plans' && (
            <PlanList 
                plans={plans} 
                onEdit={handleOpenPlanModal} 
                onDelete={deletePlan} 
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
    </div>
  );
}
