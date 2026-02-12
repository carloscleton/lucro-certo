import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Tag } from 'lucide-react';
import type { Category } from '../../hooks/useCategories';

interface CategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Category | null;
}

export function CategoryForm({ isOpen, onClose, onSubmit, initialData }: CategoryFormProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState('expense');
    const [entityType, setEntityType] = useState<'individual' | 'company'>('individual');
    const [budgetLimit, setBudgetLimit] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setEntityType((initialData as any).entity_type || 'individual');
            setBudgetLimit(initialData.budget_limit ? initialData.budget_limit.toString() : '');
        } else {
            setName('');
            setType('expense');
            setEntityType('individual');
            setBudgetLimit('');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data: any = { name, type, entity_type: entityType };
            if (type === 'expense' && budgetLimit) {
                data.budget_limit = parseFloat(budgetLimit);
            } else {
                data.budget_limit = null;
            }

            await onSubmit(data);
            onClose();
        } catch (error: any) {
            console.error('CategoryForm Error:', error);
            alert(`Erro ao salvar categoria: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Editar Categoria' : 'Nova Categoria'}
            subtitle={initialData ? 'Atualize as configurações da categoria' : 'Crie uma nova categoria para organizar suas finanças'}
            icon={Tag}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Nome da Categoria *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Ex: Alimentação, Aluguel, Vendas..."
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                        <select
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                            value={type}
                            onChange={e => setType(e.target.value)}
                        >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Perfil</label>
                        <select
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                            value={entityType}
                            onChange={e => setEntityType(e.target.value as 'individual' | 'company')}
                        >
                            <option value="individual">Pessoa Física</option>
                            <option value="company">Pessoa Jurídica</option>
                        </select>
                    </div>
                </div>

                {type === 'expense' && (
                    <div className="pt-2">
                        <Input
                            label="Meta de Gasto Mensal (Opcional)"
                            type="number"
                            step="0.01"
                            placeholder="R$ 0,00"
                            value={budgetLimit}
                            onChange={e => setBudgetLimit(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Você receberá alertas se os gastos superarem este valor.
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} className="px-8">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                        Salvar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
