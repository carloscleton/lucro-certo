import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Save, Plus, Trash2, Edit } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';

export function LandingPlansEditor() {
    const { appSettings, updateAppSettings } = useAdmin();
    const [plans, setPlans] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (appSettings?.landing_plans) {
            setPlans(appSettings.landing_plans);
        } else {
            setPlans([
                {
                    name: "Essencial",
                    price: "97",
                    period: "mês",
                    features: ["Gestão Financeira Completa", "CRM até 500 contatos", "Relatórios Básicos"],
                    button_text: "Escolher Plano",
                    button_type: "secondary",
                    is_popular: false
                },
                {
                    name: "Profissional + IA",
                    price: "197",
                    period: "mês",
                    features: ["Tudo do Essencial", "**Radar de Leads (IA)**", "**Marketing Copilot (IA)**", "WhatsApp Ilimitado"],
                    button_text: "Começar agora",
                    button_type: "primary",
                    is_popular: true
                },
                {
                    name: "Empresarial",
                    price: "497",
                    period: "mês",
                    features: ["Tudo do Profissional", "Multi-empresas (até 5)", "Suporte VIP 24h", "API de Integração"],
                    button_text: "Falar com Consultor",
                    button_type: "secondary",
                    is_popular: false
                }
            ]);
        }
    }, [appSettings]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await updateAppSettings({ landing_plans: plans });
        setSaving(false);
        if (error) {
            alert('Erro ao salvar planos: ' + error);
        } else {
            alert('Planos da Landing Page salvos com sucesso!');
        }
    };

    const updatePlan = (index: number, field: string, value: any) => {
        const newPlans = [...plans];
        newPlans[index] = { ...newPlans[index], [field]: value };
        setPlans(newPlans);
    };

    const updateFeature = (planIndex: number, featureIndex: number, value: string) => {
        const newPlans = [...plans];
        const newFeatures = [...newPlans[planIndex].features];
        newFeatures[featureIndex] = value;
        newPlans[planIndex].features = newFeatures;
        setPlans(newPlans);
    };

    const addFeature = (planIndex: number) => {
        const newPlans = [...plans];
        newPlans[planIndex].features.push('Nova feature');
        setPlans(newPlans);
    };

    const removeFeature = (planIndex: number, featureIndex: number) => {
        const newPlans = [...plans];
        newPlans[planIndex].features.splice(featureIndex, 1);
        setPlans(newPlans);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Planos da Landing Page</h3>
                    <p className="text-sm text-gray-500">Configure os valores e textos exibidos na página inicial.</p>
                </div>
                <Button onClick={handleSave} isLoading={saving}>
                    <Save size={18} className="mr-2" />
                    Salvar Alterações
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan, pIdx) => (
                    <div key={pIdx} className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <Edit size={16} className="text-blue-500" /> Card {pIdx + 1}
                            </h4>
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <input
                                    type="checkbox"
                                    checked={plan.is_popular}
                                    onChange={(e) => updatePlan(pIdx, 'is_popular', e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                Destaque Popular
                            </label>
                        </div>

                        <Input
                            label="Nome do Plano"
                            value={plan.name}
                            onChange={(e) => updatePlan(pIdx, 'name', e.target.value)}
                        />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço (R$)</label>
                                <input
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    value={plan.price}
                                    onChange={(e) => updatePlan(pIdx, 'price', e.target.value)}
                                />
                            </div>
                            <div className="w-24">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período</label>
                                <input
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    value={plan.period}
                                    onChange={(e) => updatePlan(pIdx, 'period', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Características</label>
                            <div className="space-y-2">
                                {plan.features.map((feat: string, fIdx: number) => (
                                    <div key={fIdx} className="flex gap-2">
                                        <input
                                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                            value={feat}
                                            onChange={(e) => updateFeature(pIdx, fIdx, e.target.value)}
                                        />
                                        <button
                                            onClick={() => removeFeature(pIdx, fIdx)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => addFeature(pIdx)}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                            >
                                <Plus size={14} /> Adicionar Item
                            </button>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                            <Input
                                label="Texto do Botão"
                                value={plan.button_text}
                                onChange={(e) => updatePlan(pIdx, 'button_text', e.target.value)}
                            />
                            <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estilo do Botão</label>
                                <select
                                    value={plan.button_type}
                                    onChange={(e) => updatePlan(pIdx, 'button_type', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="primary">Principal (Azul)</option>
                                    <option value="secondary">Secundário (Branco/Neutro)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
