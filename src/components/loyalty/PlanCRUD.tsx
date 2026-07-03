import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Modal } from '../ui/Modal';
import { Package, Trash2, Edit2, Info } from 'lucide-react';
import type { LoyaltyPlan } from '../../hooks/useLoyalty';
import { useNotification } from '../../context/NotificationContext';
import { useServices } from '../../hooks/useServices';
import { useTranslation } from 'react-i18next';

interface PlanFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: LoyaltyPlan | null;
}

export function PlanForm({ isOpen, onClose, onSubmit, initialData }: PlanFormProps) {
    const { t } = useTranslation();
    const { notify } = useNotification();
    const { services } = useServices();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [color, setColor] = useState('#3b82f6');
    const [isPopular, setIsPopular] = useState(false);
    const [badgeText, setBadgeText] = useState('Mais Popular');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setPrice(initialData.price);
            setDiscountPercent(initialData.discount_percent);
            setBillingCycle(initialData.billing_cycle);
            setSelectedServices(initialData.included_services || []);
            setIsActive(initialData.is_active);
            setColor(initialData.color || '#3b82f6');
            setIsPopular(initialData.is_popular || false);
            setBadgeText(initialData.badge_text || 'Mais Popular');
        } else {
            setName('');
            setDescription('');
            setPrice(0);
            setDiscountPercent(0);
            setBillingCycle('monthly');
            setSelectedServices([]);
            setIsActive(true);
            setColor('#3b82f6');
            setIsPopular(false);
            setBadgeText('Mais Popular');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name,
                description,
                price,
                discount_percent: discountPercent,
                billing_cycle: billingCycle,
                included_services: selectedServices,
                is_active: isActive,
                color,
                is_popular: isPopular,
                badge_text: badgeText
            });
            onClose();
        } catch (error) {
            console.error(error);
            notify('error', t('loyalty.save_error', 'Erro ao salvar o plano.'), t('common.error', 'Erro'));
        } finally {
            setLoading(false);
        }
    };

    const toggleService = (serviceId: string) => {
        setSelectedServices(prev => 
            prev.includes(serviceId) 
                ? prev.filter(id => id !== serviceId) 
                : [...prev, serviceId]
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? t('loyalty.edit_plan', 'Editar Plano') : t('loyalty.new_plan_modal', 'Novo Plano de Fidelidade')}
            icon={Package}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <Input
                            label={t('loyalty.plan_name_label', 'Nome do Plano *')}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('loyalty.plan_name_placeholder', 'Ex: Plano Ouro, Assinatura VIP...')}
                            required
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            {t('loyalty.plan_desc_label', 'Descrição do Plano')}
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                            rows={3}
                            placeholder={t('loyalty.plan_desc_placeholder', 'Descreva os benefícios do plano...')}
                        />
                    </div>

                    <CurrencyInput
                        label={t('loyalty.price_label', 'Valor Mensal (${window.__CURRENCY_SYMBOL__ || `${window.__CURRENCY_SYMBOL__ || "R$"}`})*')}
                        value={price}
                        onChange={num => setPrice(num)}
                        required
                    />

                    <Input
                        label={t('loyalty.discount_label', 'Desconto em Serviços (%)')}
                        type="number"
                        step="0.1"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(Number(e.target.value))}
                        helpText={t('loyalty.discount_help', 'Desconto aplicado automaticamente em orçamentos')}
                    />
                </div>

                {/* Estilo & Destaque */}
                <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-gray-200 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                        <Edit2 size={16} className="text-amber-500" />
                        Design e Destaque do Card
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-750 dark:text-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPopular}
                                    onChange={e => setIsPopular(e.target.checked)}
                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                />
                                Destacar este Plano (Mais Popular)
                            </label>
                        </div>

                        {isPopular && (
                            <Input
                                label="Texto do Destaque (Badge)"
                                value={badgeText}
                                onChange={e => setBadgeText(e.target.value)}
                                placeholder="Ex: Mais Popular, Recomendado"
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Cor do Cabeçalho / Destaque
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { name: 'Azul', value: '#3b82f6' },
                                { name: 'Verde', value: '#10b981' },
                                { name: 'Laranja', value: '#f59e0b' },
                                { name: 'Índigo', value: '#6366f1' },
                                { name: 'Roxo', value: '#8b5cf6' },
                                { name: 'Rosa', value: '#f43f5e' },
                            ].map(preset => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setColor(preset.value)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer relative flex items-center justify-center ${color === preset.value ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: preset.value }}
                                    title={preset.name}
                                >
                                    {color === preset.value && (
                                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                    )}
                                </button>
                            ))}
                            <div className="flex items-center gap-2 ml-4">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="w-8 h-8 rounded-full border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                                />
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono select-all">
                                    {color}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {t('loyalty.included_services_label', 'Serviços Inclusos / Com Desconto Especial')}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 border rounded-xl bg-gray-50 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700">
                        {services.map(s => (
                            <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={selectedServices.includes(s.id)}
                                    onChange={() => toggleService(s.id)}
                                    className="rounded border-gray-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 transition-colors">
                                    {s.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                        <Info size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">{t('loyalty.plan_status', 'Status do Plano')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">{isActive ? t('common.active', 'Ativo') : t('common.inactive', 'Inativo')}</span>
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                    <Button type="button" variant="outline" onClick={onClose}>
                        {t('common.cancel', 'Cancelar')}
                    </Button>
                    <Button type="submit" isLoading={loading} className="bg-amber-600 hover:bg-amber-700">
                        {initialData ? t('common.update', 'Atualizar Plano') : t('common.create', 'Criar Plano')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

interface PlanListProps {
    plans: LoyaltyPlan[];
    onEdit: (plan: LoyaltyPlan) => void;
    onDelete: (id: string) => void;
}

export function PlanList({ plans, onEdit, onDelete }: PlanListProps) {
    const { t } = useTranslation();
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(val);
    };

    if (plans.length === 0) {
        return (
            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-slate-800">
                <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Package className="text-gray-300 dark:text-gray-600" size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('loyalty.no_plans', 'Crie seu primeiro plano')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">{t('loyalty.no_plans_desc', 'Defina os benefícios e o valor mensal para começar a fidelizar seus clientes.')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map(plan => (
                <div 
                    key={plan.id} 
                    className={`relative group bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${plan.is_popular ? 'shadow-lg border-2' : 'border-gray-100 dark:border-slate-800'} ${!plan.is_active && 'grayscale opacity-60'}`}
                    style={{ borderColor: plan.is_popular ? plan.color || '#3b82f6' : undefined }}
                >
                    {plan.is_popular && (
                        <div 
                            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[8px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-md z-10"
                            style={{ backgroundColor: plan.color || '#3b82f6' }}
                        >
                            {plan.badge_text || 'Mais Popular'}
                        </div>
                    )}
                    <div className="flex justify-between items-start mb-8">
                        <div 
                            className="p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform duration-500"
                            style={{ backgroundColor: `${plan.color || '#3b82f6'}15` }}
                        >
                            <Package style={{ color: plan.color || '#3b82f6' }} size={28} />
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <button 
                                onClick={() => onEdit(plan)} 
                                className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors"
                                title="Editar"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button 
                                onClick={() => onDelete(plan.id)} 
                                className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 transition-colors"
                                title="Excluir"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1 mb-8">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{plan.name}</h3>
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em]">
                            {plan.billing_cycle === 'monthly' ? t('loyalty.monthly_cycle', 'Assinatura Mensal') : t('loyalty.yearly_cycle', 'Assinatura Anual')}
                        </p>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 line-clamp-2 h-10 font-medium">
                        {plan.description || 'Sem descrição definida para este plano de fidelidade.'}
                    </p>
                    
                    <div className="space-y-4 pt-6 border-t border-gray-50 dark:border-slate-800">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('loyalty.monthly_value', 'Mensalidade')}</span>
                            <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter italic">
                                {formatCurrency(plan.price)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{t('loyalty.service_discount_label', 'Desconto VIP')}</span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 italic">
                                {plan.discount_percent}%
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
