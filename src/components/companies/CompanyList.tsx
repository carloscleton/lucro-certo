import { Edit2, Trash2, Building2 } from 'lucide-react';
import type { Company } from '../../hooks/useCompanies';
import { Tooltip } from '../ui/Tooltip';

interface CompanyListProps {
    companies: Company[];
    onEdit: (company: Company) => void;
    onDelete: (id: string) => void;
}

export function CompanyList({ companies, onEdit, onDelete }: CompanyListProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    Nenhuma empresa cadastrada.
                </div>
            ) : (
                companies.map((company) => (
                    <div key={company.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg overflow-hidden flex items-center justify-center w-12 h-12">
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
                                <div>
                                    <h3 className="font-semibold text-gray-900">{company.trade_name}</h3>
                                    <p className="text-sm text-gray-500">{company.cnpj || 'Sem CNPJ'}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Tooltip content="Editar">
                                    <button
                                        onClick={() => onEdit(company)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
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
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                        {company.legal_name && (
                            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                                {company.legal_name}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
