import { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { useCategories, type Category } from '../hooks/useCategories';
import { CategoryList } from '../components/categories/CategoryList';
import { CategoryForm } from '../components/categories/CategoryForm';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useTeam } from '../hooks/useTeam';

export function Categories() {
    const { categories, loading, addCategory, updateCategory, deleteCategory, duplicateCategory } = useCategories();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Permission Check
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { members } = useTeam();

    let canDelete = true;
    if (currentEntity.type === 'company' && user) {
        const company = companies.find(c => c.id === currentEntity.id);
        const myMembership = members.find(m => m.user_id === user.id);

        const isOwnerOrAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
        const memberCanDelete = company?.settings?.member_can_delete ?? false;

        if (!isOwnerOrAdmin && !memberCanDelete) {
            canDelete = false;
        }
    }

    const handleClone = async (category: Category) => {
        if (confirm(`Deseja clonar a categoria "${category.name}" para o outro perfil?`)) {
            try {
                const targetLabel = await duplicateCategory(category);
                alert(`Categoria clonada com sucesso para o perfil: ${targetLabel}!`);
            } catch (err) {
                console.error(err);
                alert('Erro ao clonar categoria.');
            }
        }
    };

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
        } else {
            setEditingCategory(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    const handleSubmit = async (data: any) => {
        if (editingCategory) {
            await updateCategory(editingCategory.id, data);
        } else {
            await addCategory(data);
        }
    };

    if (loading) return <div>Carregando categorias...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Tag className="text-blue-600" />
                        Categorias
                    </h1>
                    <p className="text-gray-500">Gerencie as categorias de suas receitas e despesas.</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={20} className="mr-2" />
                    Nova Categoria
                </Button>
            </div>

            <CategoryList
                categories={categories}
                onEdit={handleOpenModal}
                onDelete={async (id) => {
                    if (!canDelete) {
                        alert('Você não tem permissão para excluir categorias.');
                        return;
                    }
                    await deleteCategory(id);
                }}
                onClone={handleClone}
                canDelete={canDelete}
            />

            <CategoryForm
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                initialData={editingCategory}
            />
        </div>
    );
}
