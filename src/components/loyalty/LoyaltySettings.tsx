import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Settings, CreditCard, Shield, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import type { LoyaltySettings as LoyaltySettingsType } from '../../hooks/useLoyalty';
import { useNotification } from '../../context/NotificationContext';
import { usePaymentGateways } from '../../hooks/usePaymentGateways';

interface LoyaltySettingsProps {
    settings: LoyaltySettingsType;
    onUpdate: (updates: Partial<LoyaltySettingsType>) => Promise<void>;
    isAdmin?: boolean;
}

export function LoyaltySettings({ settings, onUpdate, isAdmin }: LoyaltySettingsProps) {
    const { notify } = useNotification();
    const { gateways } = usePaymentGateways();
    const [enabled, setEnabled] = useState(settings.enabled);
    const [gatewayType, setGatewayType] = useState(settings.gateway_type);
    const [dueDay, setDueDay] = useState(settings.due_day);
    const [graceDays, setGraceDays] = useState(settings.grace_days);
    const [platformFee, setPlatformFee] = useState(settings.platform_fee_percent);
    const [alertOnCheckin, setAlertOnCheckin] = useState(settings.alert_on_checkin);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setEnabled(settings.enabled);
        setGatewayType(settings.gateway_type);
        setDueDay(settings.due_day);
        setGraceDays(settings.grace_days);
        setPlatformFee(settings.platform_fee_percent);
        setAlertOnCheckin(settings.alert_on_checkin);
    }, [settings]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onUpdate({
                enabled,
                gateway_type: gatewayType,
                due_day: dueDay,
                grace_days: graceDays,
                platform_fee_percent: platformFee,
                alert_on_checkin: alertOnCheckin
            });
            notify('success', 'Configurações salvas com sucesso!', 'Pronto');
        } catch (error) {
            console.error(error);
            notify('error', 'Erro ao salvar configurações.', 'Erro');
        } finally {
            setLoading(false);
        }
    };

    const hasAnyGateway = gateways.length > 0;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Status do Módulo */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-xl">
                                <Shield className="text-amber-600 dark:text-amber-400" size={24} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Ativação do Clube</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xl">
                            Ao desativar o módulo, nenhum novo assinante poderá se cadastrar e as cobranças recorrentes serão suspensas até a reativação.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enabled}
                            onChange={e => setEnabled(e.target.checked)}
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600 shadow-sm"></div>
                    </label>
                </div>
            </section>

            {/* Gateway de Pagamento */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl">
                        <CreditCard className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Cobrança e Gateway</h3>
                </div>

                {!hasAnyGateway && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center gap-4">
                        <AlertTriangle className="text-red-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-900 dark:text-red-100">Configuração Obrigatória</p>
                            <p className="text-xs text-red-600 dark:text-red-400">Você precisa configurar um gateway (Asaas ou Mercado Pago) na aba de Pagamentos do sistema antes de começar a vender planos.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                            Provedor de Pagamento
                        </label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setGatewayType('asaas')}
                                className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${gatewayType === 'asaas' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                            >
                                <span className="block font-black text-blue-600 mb-1 tracking-tighter italic">ASAAS</span>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Recomendado</span>
                            </button>
                            <button
                                onClick={() => setGatewayType('mercadopago')}
                                className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${gatewayType === 'mercadopago' ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-100 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                            >
                                <span className="block font-black text-amber-600 mb-1 tracking-tighter italic font-serif">Mercado Pago</span>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Alternativo</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                            <Key size={16} />
                            <span className="text-xs font-bold uppercase">Integração Ativa</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Usando as credenciais globais da empresa configuradas em <a href="/dashboard/settings?tab=payments" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1">Configurações <ExternalLink size={10} /></a>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Ciclo e Regras */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-xl">
                        <Settings className="text-emerald-600 dark:text-emerald-400" size={24} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Regras de Cobrança</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Dia de Vencimento"
                        type="number"
                        min={1}
                        max={28}
                        value={dueDay}
                        onChange={e => setDueDay(Number(e.target.value))}
                        placeholder="Ex: 10"
                        helpText="Dia padrão para a cobrança mensal"
                    />

                    <Input
                        label="Dias de Carência"
                        type="number"
                        min={0}
                        max={15}
                        value={graceDays}
                        onChange={e => setGraceDays(Number(e.target.value))}
                        placeholder="Ex: 3"
                        helpText="Dias extras antes de marcar como atrasado"
                    />

                    {isAdmin && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/50">
                            <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Shield size={14} />
                                Configurações Administrativas
                            </h4>
                            <Input
                                label="Taxa da Plataforma (%)"
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={platformFee}
                                onChange={e => setPlatformFee(Number(e.target.value))}
                                placeholder="Ex: 5.0"
                                helpText="Percentual cobrado pela plataforma sobre as assinaturas. Visível apenas para administradores."
                            />
                        </div>
                    )}

                    <div className="md:col-span-2 flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Notificar no Check-in</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Mostrar alerta no sistema se o cliente estiver inadimplente ao abrir um orçamento</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={alertOnCheckin}
                                onChange={e => setAlertOnCheckin(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>
            </section>

            <div className="flex justify-end sticky bottom-6 z-20">
                <Button 
                    onClick={handleSave} 
                    isLoading={loading} 
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-12 py-6 rounded-2xl shadow-2xl hover:scale-105 transition-transform"
                >
                    Salvar Alterações
                </Button>
            </div>
        </div>
    );
}
