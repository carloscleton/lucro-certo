import { useState } from 'react';
import { Plus, Building } from 'lucide-react';
import { useCompanies, type Company } from '../hooks/useCompanies';
import { CompanyList } from '../components/companies/CompanyList';
import { CompanyForm } from '../components/companies/CompanyForm';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export function Companies() {
    const { profile } = useAuth(); // Get user profile for max_companies
    const { companies, loading, addCompany, updateCompany, deleteCompany } = useCompanies();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

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

    if (loading) return <div>Carregando empresas...</div>;

    const maxCompanies = profile?.max_companies ?? 1; // Default to 1 if not set
    const canCreateCompany = companies.length < maxCompanies;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Building className="text-blue-600" />
                        Minhas Empresas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie as empresas e contas que você administra.</p>
                </div>
                {canCreateCompany ? (
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={20} className="mr-2" />
                        Nova Empresa
                    </Button>
                ) : (
                    <div className="flex flex-col items-end">
                        <Button disabled className="opacity-50 cursor-not-allowed">
                            <Plus size={20} className="mr-2" />
                            Nova Empresa
                        </Button>
                        <span className="text-xs text-red-500 mt-1">
                            Limite atingido ({companies.length}/{maxCompanies})
                        </span>
                    </div>
                )}
            </div>

            <CompanyList
                companies={companies}
                onEdit={handleOpenModal}
                onDelete={deleteCompany}
            />

            <CompanyForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                initialData={editingCompany}
            />
        </div>
    );
}
