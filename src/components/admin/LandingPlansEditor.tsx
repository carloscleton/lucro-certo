import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Save, Plus, Trash2, Edit, Sparkles } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useEntity } from '../../context/EntityContext';
import { supabase } from '../../lib/supabase';
import { APP_MODULES } from '../../config/permissions';
import { Check } from 'lucide-react';

const COMPANY_MODULE_OPTIONS = [
    { key: 'fiscal_module_enabled', label: 'Módulo Fiscal' },
    { key: 'payments_module_enabled', label: 'Módulo Pagamentos' },
    { key: 'crm_module_enabled', label: 'CRM / Funil' },
    { key: 'has_social_copilot', label: 'Marketing IA' },
    { key: 'automations_module_enabled', label: 'Automações' },
    { key: 'has_lead_radar', label: 'Radar de Leads' },
];

export function LandingPlansEditor() {
    const { appSettings, updateAppSettings } = useAdmin();
    const { currentEntity } = useEntity();
    const [plans, setPlans] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [generatingMagic, setGeneratingMagic] = useState<number | null>(null);

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

    const toggleCompanyModule = (planIndex: number, moduleKey: string) => {
        const newPlans = [...plans];
        const plan = { ...newPlans[planIndex] };
        const modules = { ...(plan.modules || {}) };
        
        // Empresa modules are direct booleans
        modules[moduleKey] = !modules[moduleKey];
        
        plan.modules = modules;
        newPlans[planIndex] = plan;
        setPlans(newPlans);
    };

    const toggleProfileModule = (planIndex: number, moduleKey: string) => {
        const newPlans = [...plans];
        const plan = { ...newPlans[planIndex] };
        const modules = { ...(plan.profile_modules || {}) };
        
        // Profile modules (Sidebar) use the { admin, member } structure
        const isEnabled = modules[moduleKey]?.admin === true;
        modules[moduleKey] = {
            admin: !isEnabled,
            member: !isEnabled
        };
        
        plan.profile_modules = modules;
        newPlans[planIndex] = plan;
        setPlans(newPlans);
    };

    const handleMagic = async (pIdx: number) => {
        const plan = plans[pIdx];
        setGeneratingMagic(pIdx);
        try {
            const promptText = plan.observation?.trim()
                ? `Melhore, encurte e torne mais persuasiva e comercial a seguinte explicação (máximo de 6 a 10 palavras), que será exibida embaixo do preço do plano "${plan.name}" (R$${plan.price}). Texto original do usuário: "${plan.observation}". Não use aspas na resposta, apenas retorne a frase melhorada, mantendo o sentido original.`
                : `Gere uma frase curtíssima e persuasiva (máximo de 5 a 6 palavras) para exibir embaixo do preço de um plano de sistema SaaS. Nome do plano: "${plan.name}". Preço: R$${plan.price}. Exemplo de saída desejada: "Ideal para Autônomos" ou "O mais completo do mercado". Não use aspas na resposta.`;

            const { data, error } = await supabase.functions.invoke('social-copilot-magic', {
                body: {
                    company_id: currentEntity?.id || '',
                    mode: 'landing_plan_magic',
                    topic: promptText
                }
            });

            if (error) {
                console.error("Erro da IA do Supabase:", error);
            }

            if (data?.template) {
                updatePlan(pIdx, 'observation', data.template.replace(/["']/g, '').trim());
            } else {
                alert('Erro ao gerar texto com IA.');
            }
        } catch (err) {
            console.error(err);
            alert('Falha na comunicação com a IA.');
        } finally {
            setGeneratingMagic(null);
        }
    };

    const updatePlan = (index: number, field: string, value: any) => {
        const newPlans = [...plans];
        newPlans[index] = { ...newPlans[index], [field]: value };
        setPlans(newPlans);
    };

    const addPlan = () => {
        const newPlan = {
            name: "Novo Plano",
            price: "97",
            period: "mês",
            features: ["Feature 1", "Feature 2"],
            button_text: "Assinar Agora",
            button_type: "primary",
            is_popular: false,
            enabled: true
        };
        setPlans([...plans, newPlan]);
    };

    const removePlan = (index: number) => {
        if (!window.confirm('Tem certeza que deseja remover este plano?')) return;
        const newPlans = plans.filter((_, i) => i !== index);
        setPlans(newPlans);
    };

    const resetToDefaults = () => {
        if (!window.confirm('Isso irá substituir seus planos atuais pelos padrões. Deseja continuar?')) return;
        setPlans([
            {
                name: "Essencial",
                price: "97",
                period: "mês",
                features: ["Gestão Financeira Completa", "CRM até 500 contatos", "Relatórios Básicos"],
                button_text: "Escolher Plano",
                button_type: "secondary",
                is_popular: false,
                enabled: true
            },
            {
                name: "Profissional + IA",
                price: "197",
                period: "mês",
                features: ["Tudo do Essencial", "**Radar de Leads (IA)**", "**Marketing Copilot (IA)**", "WhatsApp Ilimitado"],
                button_text: "Começar agora",
                button_type: "primary",
                is_popular: true,
                enabled: true
            },
            {
                name: "Empresarial",
                price: "497",
                period: "mês",
                features: ["Tudo do Profissional", "Multi-empresas (até 5)", "Suporte VIP 24h", "API de Integração"],
                button_text: "Falar com Consultor",
                button_type: "secondary",
                is_popular: false,
                enabled: true
            }
        ]);
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
                <div className="flex items-center gap-3">
                    <button 
                        onClick={resetToDefaults}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors mr-4"
                    >
                        Resetar Padrões
                    </button>
                    <Button onClick={handleSave} isLoading={saving}>
                        <Save size={18} className="mr-2" />
                        Salvar Alterações
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan, pIdx) => (
                    <div 
                        key={pIdx} 
                        className={`border rounded-2xl p-6 space-y-4 transition-all relative ${
                            plan.enabled === false 
                                ? 'bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-slate-800 opacity-60 grayscale' 
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm'
                        }`}
                    >
                        {/* Exibir Tag de Oculto se desativado */}
                        {plan.enabled === false && (
                            <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider z-10 shadow-lg">
                                Oculto na Página
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h4 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Edit size={16} className="text-blue-500" /> #{pIdx + 1}
                                </h4>
                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={plan.enabled !== false}
                                        onChange={(e) => updatePlan(pIdx, 'enabled', e.target.checked)}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className={plan.enabled !== false ? 'text-emerald-600' : 'text-gray-400'}>
                                        {plan.enabled !== false ? 'Visível' : 'Oculto'}
                                    </span>
                                </label>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={plan.is_popular}
                                        onChange={(e) => updatePlan(pIdx, 'is_popular', e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    Destaque
                                </label>
                                <button 
                                    onClick={() => removePlan(pIdx)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                    title="Excluir Plano"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
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
                            <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                                    Observação do Plano
                                    <button
                                        onClick={() => handleMagic(pIdx)}
                                        disabled={generatingMagic === pIdx}
                                        className="text-[10px] flex items-center gap-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                                    >
                                        <Sparkles size={12} />
                                        {generatingMagic === pIdx ? 'Gerando...' : 'IA'}
                                    </button>
                                </label>
                                <input
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                    placeholder="Ex: Ideal para quem está começando..."
                                    value={plan.observation || ''}
                                    onChange={(e) => updatePlan(pIdx, 'observation', e.target.value)}
                                />
                            </div>

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
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link de Pagamento (Gateway)</label>
                                <input
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                    placeholder="Ex: https://pay.kiwify.com.br/..."
                                    value={plan.checkout_url || ''}
                                    onChange={(e) => updatePlan(pIdx, 'checkout_url', e.target.value)}
                                />
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Acesso ao Sidebar (Perfil)</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        {APP_MODULES.filter(m => !['settings'].includes(m.key)).map((mod) => {
                                            const isEnabled = plan.profile_modules?.[mod.key]?.admin === true;
                                            return (
                                                <button
                                                    key={mod.key}
                                                    onClick={() => toggleProfileModule(pIdx, mod.key)}
                                                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-[9px] font-bold transition-all text-left ${
                                                        isEnabled 
                                                            ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300' 
                                                            : 'bg-white text-gray-400 border border-gray-100 dark:bg-slate-800 dark:text-gray-500 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${isEnabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                                                        {isEnabled && <Check size={8} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="truncate">{mod.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Módulos Ativos (Empresa)</label>
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                        {COMPANY_MODULE_OPTIONS.map((mod) => {
                                            const isEnabled = !!plan.modules?.[mod.key];
                                            return (
                                                <button
                                                    key={mod.key}
                                                    onClick={() => toggleCompanyModule(pIdx, mod.key)}
                                                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-[9px] font-bold transition-all text-left ${
                                                        isEnabled 
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                            : 'bg-white text-gray-400 border border-gray-100 dark:bg-slate-800 dark:text-gray-500 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${isEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
                                                        {isEnabled && <Check size={8} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="truncate">{mod.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-400 italic">Define os privilégios iniciais do plano</p>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Botão Adicionar Novo Plano */}
                <button 
                    onClick={addPlan}
                    className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center py-12 px-6 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group min-h-[400px]"
                >
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Plus size={24} className="text-blue-600" />
                    </div>
                    <span className="font-bold text-gray-600 dark:text-gray-300">Adicionar Novo Plano</span>
                    <p className="text-xs text-gray-400 mt-2 text-center">Crie uma nova opção de card para sua página inicial</p>
                </button>
            </div>
        </div>
    );
}
