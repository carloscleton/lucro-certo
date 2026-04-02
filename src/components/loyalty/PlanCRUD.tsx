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

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setPrice(initialData.price);
            setDiscountPercent(initialData.discount_percent);
            setBillingCycle(initialData.billing_cycle);
            setSelectedServices(initialData.included_services || []);
            setIsActive(initialData.is_active);
        } else {
            setName('');
            setDescription('');
            setPrice(0);
            setDiscountPercent(0);
            setBillingCycle('monthly');
            setSelectedServices([]);
            setIsActive(true);
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
                is_active: isActive
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
                        label={t('loyalty.price_label', 'Valor Mensal (R$)*')}
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
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <Package className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('loyalty.no_plans', 'Nenhum plano criado')}</h3>
                <p className="text-gray-500 dark:text-gray-400">{t('loyalty.no_plans_desc', 'Comece criando seu primeiro plano de fidelidade clicando no botão acima.')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
                <div key={plan.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 transition-all hover:shadow-xl ${plan.is_active ? 'border-amber-100 dark:border-amber-900/30' : 'border-gray-100 dark:border-slate-700 bg-gray-50/50 grayscale'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-xl">
                            <Package className="text-amber-600 dark:text-amber-400" size={24} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onEdit(plan)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => onDelete(plan.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{plan.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 h-10">{plan.description}</p>
                    
                    <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-gray-500">{t('loyalty.monthly_value', 'Valor Mensal')}:</span>
                            <span className="text-amber-600 dark:text-amber-400 font-black text-lg tabular-nums italic">
                                {formatCurrency(plan.price)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-gray-500">{t('loyalty.service_discount_label', 'Desconto em Serviços')}:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {plan.discount_percent}%
                            </span>
                        </div>
                    </div>

                    <div className="mt-6">
                       <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest bg-gray-100 dark:bg-slate-700 text-gray-500`}>
                           {plan.billing_cycle === 'monthly' ? t('loyalty.monthly_cycle', 'Ciclo Mensal') : t('loyalty.yearly_cycle', 'Ciclo Anual')}
                       </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
