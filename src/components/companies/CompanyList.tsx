import { Edit2, Trash2, Building2, CheckCircle2, Eye } from 'lucide-react';
import type { Company } from '../../hooks/useCompanies';
import { Tooltip } from '../ui/Tooltip';

interface CompanyListProps {
    companies: Company[];
    currentEntityId?: string;
    onEdit: (company: Company) => void;
    onDelete: (id: string) => void;
    onSelect?: (company: Company) => void;
    onViewFiscalSettings?: (company: Company) => void;
}

export function CompanyList({ companies, currentEntityId, onEdit, onDelete, onSelect, onViewFiscalSettings }: CompanyListProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
                    Nenhuma empresa cadastrada.
                </div>
            ) : (
                companies.map((company) => {
                    const isActive = company.id === currentEntityId;
                    return (
                        <div key={company.id} className={`bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border transition-all ${isActive ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-slate-800'}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl overflow-hidden flex items-center justify-center w-12 h-12 shrink-0">
                                        {company.logo_url ? (
                                            <img
                                                src={company.logo_url}
                                                alt={company.trade_name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <Building2 size={24} />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{company.trade_name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{company.cnpj || 'Sem CNPJ'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {onViewFiscalSettings && (
                                        <Tooltip content="Ver Configurações Fiscais / Emissão">
                                            <button
                                                onClick={() => onViewFiscalSettings(company)}
                                                className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </Tooltip>
                                    )}
                                    <Tooltip content="Editar">
                                        <button
                                            onClick={() => onEdit(company)}
                                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip content="Excluir">
                                        <button
                                            onClick={() => {
                                                if (confirm('Tem certeza que deseja excluir?')) {
                                                    onDelete(company.id);
                                                }
                                            }}
                                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {company.legal_name || 'Razão Social não informada'}
                                </div>
                                {isActive ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                                        <CheckCircle2 size={14} /> Ativa
                                    </span>
                                ) : (
                                    onSelect && (
                                        <button
                                            onClick={() => onSelect(company)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 transition-all shrink-0 active:scale-95"
                                        >
                                            <CheckCircle2 size={14} /> Ativar Empresa
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
