import React from 'react';
import { X, Check, CheckCircle2, Shield } from 'lucide-react';
import { APP_MODULES, SETTINGS_TABS } from '../../config/permissions';

interface PlanDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: any;
}

export function PlanDetailsModal({ isOpen, onClose, plan }: PlanDetailsModalProps) {
    if (!isOpen || !plan) return null;

    const allowedType = plan.allowed_entity_type || 'BOTH';

    const renderPermissionTable = (title: string, type: 'PF' | 'PJ', colorClass: string) => {
        const profileModules = plan.profile_modules || {};
        const settingsTabs = plan.settings_tabs || {};

        return (
            <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                    <div className={`w-1.5 h-4 rounded-full ${colorClass}`} />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">{title}</h4>
                </div>

                <div className="space-y-4">
                    {/* Sidebar permissions */}
                    <div>
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Acesso ao Sidebar (Perfil)</span>
                        <div className="overflow-hidden border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50/30 dark:bg-slate-950/20 max-h-60 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest text-[8px]">Módulo</th>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 text-center w-16 uppercase tracking-widest text-[8px]">Admin</th>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 text-center w-16 uppercase tracking-widest text-[8px]">Membro</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                    {APP_MODULES.map((mod) => {
                                        const adminEnabled = profileModules[mod.key]?.admin === true;
                                        const memberEnabled = profileModules[mod.key]?.member === true;
                                        return (
                                            <tr key={mod.key} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-semibold text-[11px]">{mod.label}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-center">
                                                        {adminEnabled ? (
                                                            <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-slate-700">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-center">
                                                        {memberEnabled ? (
                                                            <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-slate-700">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Settings tabs permissions */}
                    <div>
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Áreas de Configuração</span>
                        <div className="overflow-hidden border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50/30 dark:bg-slate-950/20 max-h-60 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest text-[8px]">Aba</th>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 text-center w-16 uppercase tracking-widest text-[8px]">Admin</th>
                                        <th className="px-4 py-2 font-bold text-gray-500 dark:text-gray-300 text-center w-16 uppercase tracking-widest text-[8px]">Membro</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                    {SETTINGS_TABS.filter(t => !['admin', 'permissions'].includes(t.key)).map((tab) => {
                                        const adminEnabled = settingsTabs[tab.key]?.admin === true;
                                        const memberEnabled = settingsTabs[tab.key]?.member === true;
                                        return (
                                            <tr key={tab.key} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-semibold text-[11px]">{tab.label}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-center">
                                                        {adminEnabled ? (
                                                            <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-slate-700">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-center">
                                                        {memberEnabled ? (
                                                            <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-slate-700">-</span>
                                                        )}
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
            </div>
        );
    };

    // Filter active company modules
    const activeCompanyModules = Object.entries(plan.modules || {})
        .filter(([_, enabled]) => !!enabled)
        .map(([key]) => {
            const labels: any = {
                fiscal_module_enabled: 'Módulo Fiscal',
                payments_module_enabled: 'Módulo Pagamentos',
                crm_module_enabled: 'CRM / Funil',
                has_social_copilot: 'Marketing IA',
                automations_module_enabled: 'Automações',
                has_lead_radar: 'Radar de Leads',
                loyalty_module_enabled: 'Clube de Fidelidade',
                banking_module_enabled: 'Integração Bancária',
                warranty_module_enabled: 'Controle de Garantia'
            };
            return labels[key] || key;
        });

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                Detalhes e Recursos: {plan.name}
                            </h3>
                            <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-wider">
                                R$ {plan.price}/{plan.period || 'mês'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{plan.observation || 'Lista completa de permissões e módulos habilitados.'}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    
                    {/* Tipo de Cadastro Permitido */}
                    <div className="bg-blue-50/20 dark:bg-slate-800/20 border border-blue-100/50 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div>
                            <span className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Tipo de Cadastro Permitido</span>
                            <span className="text-xs font-black text-gray-800 dark:text-gray-200 mt-1 block">
                                {allowedType === 'BOTH' ? 'AMBOS (Pessoa Física e Jurídica)' : allowedType === 'PF' ? 'Apenas Pessoa Física (PF)' : 'Apenas Pessoa Jurídica (PJ)'}
                            </span>
                        </div>
                        <Shield className="text-blue-500 shrink-0" size={24} />
                    </div>

                    {/* Active Company Modules */}
                    <div>
                        <span className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2.5 uppercase tracking-widest">Módulos Ativos (Empresa)</span>
                        {activeCompanyModules.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {activeCompanyModules.map((modLabel, mIdx) => (
                                    <span 
                                        key={mIdx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl shadow-sm"
                                    >
                                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                        {modLabel}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">Nenhum módulo de empresa ativo neste plano.</p>
                        )}
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* PF permissions */}
                        {(allowedType === 'PF' || allowedType === 'BOTH') && (
                            renderPermissionTable('Permissões Pessoa Física (PF)', 'PF', 'bg-blue-500')
                        )}

                        {/* PJ permissions */}
                        {(allowedType === 'PJ' || allowedType === 'BOTH') && (
                            renderPermissionTable('Permissões Pessoa Jurídica (PJ)', 'PJ', 'bg-orange-500')
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800/20 border-t border-gray-150 dark:border-slate-800 flex justify-end shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                        Fechar Detalhes
                    </button>
                </div>

            </div>
        </div>
    );
}
