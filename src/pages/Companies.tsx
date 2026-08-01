import { useState } from 'react';
import { Plus, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCompanies, type Company } from '../hooks/useCompanies';
import { CompanyList } from '../components/companies/CompanyList';
import { CompanyForm } from '../components/companies/CompanyForm';
import { CompanyFiscalModal } from '../components/companies/CompanyFiscalModal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export function Companies() {
    const { profile } = useAuth(); // Get user profile for max_companies
    const { companies, loading, addCompany, updateCompany, deleteCompany } = useCompanies();
    const { currentEntity, switchEntity, availableEntities } = useEntity();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [viewingFiscalCompany, setViewingFiscalCompany] = useState<Company | null>(null);
    const { t } = useTranslation();

    const handleSelectCompany = (company: Company) => {
        const found = availableEntities.find(e => e.id === company.id);
        if (found) {
            switchEntity(found);
        } else {
            switchEntity({
                type: 'company',
                id: company.id,
                name: company.trade_name,
                legal_name: company.legal_name,
                cnpj: company.cnpj,
                logo_url: company.logo_url,
                status: company.status
            });
        }
    };

    const handleOpenModal = (company?: Company) => {
        if (company) {
            setEditingCompany(company);
        } else {
            setEditingCompany(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCompany(null);
    };

    const handleSubmit = async (data: any) => {
        if (editingCompany) {
            await updateCompany(editingCompany.id, data);
        } else {
            await addCompany(data);
        }
    };

    if (loading) return <div>{t('common.loading')}</div>;

    const maxCompanies = profile?.max_companies ?? 1; // Default to 1 if not set
    const canCreateCompany = (companies.length < maxCompanies) && (profile?.settings?.can_create_companies !== false);

    const limitPercentage = Math.min((companies.length / maxCompanies) * 100, 100);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Building className="text-blue-600" />
                        {t('companies.title')}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                        <p className="text-gray-500 dark:text-gray-400">{t('companies.subtitle')}</p>
                        <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                            {companies.length} de {maxCompanies} {maxCompanies === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}
                        </span>
                    </div>
                </div>
                {canCreateCompany ? (
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={20} className="mr-2" />
                        {t('companies.new_company')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-end">
                        <Button disabled className="opacity-50 cursor-not-allowed">
                            <Plus size={20} className="mr-2" />
                            {t('companies.new_company')}
                        </Button>
                        <span className="text-xs text-red-500 mt-1">
                            Limite atingido ({companies.length}/{maxCompanies})
                        </span>
                    </div>
                )}
            </div>

            {/* Indicador de Limites */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Building size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Limite do Plano: Cadastro de Empresas</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Você possui {companies.length} de {maxCompanies} {maxCompanies === 1 ? 'empresa cadastrada' : 'empresas cadastradas'} no seu limite atual.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto min-w-[200px]">
                    <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${limitPercentage}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {companies.length} / {maxCompanies}
                    </span>
                </div>
            </div>

            <CompanyList
                companies={companies}
                currentEntityId={currentEntity.id}
                onEdit={handleOpenModal}
                onDelete={deleteCompany}
                onSelect={handleSelectCompany}
                onViewFiscalSettings={(company) => setViewingFiscalCompany(company)}
            />

            <CompanyForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                initialData={editingCompany}
            />

            <CompanyFiscalModal
                isOpen={!!viewingFiscalCompany}
                onClose={() => setViewingFiscalCompany(null)}
                company={viewingFiscalCompany}
            />
        </div>
    );
}

