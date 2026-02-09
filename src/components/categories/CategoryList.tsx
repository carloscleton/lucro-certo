import { Edit2, Trash2, Copy } from 'lucide-react';
import type { Category } from '../../hooks/useCategories';
import { Tooltip } from '../ui/Tooltip';

interface CategoryListProps {
    categories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (id: string) => void;
    onClone: (category: Category) => void;
    canDelete?: boolean;
}

export function CategoryList({ categories, onEdit, onDelete, onClone, canDelete = true }: CategoryListProps) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <table className="w-full text-sm text-left">
                {/* ... existing header ... */}
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Pessoa</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {categories.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                Nenhuma categoria cadastrada.
                            </td>
                        </tr>
                    ) : (
                        categories.map((category) => (
                            <tr key={category.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                {/* ... existing cells ... */}
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{category.name}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${category.type === 'income'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                        }`}>
                                        {category.type === 'income' ? 'Receita' : 'Despesa'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                                        {(category as any).entity_type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                    <Tooltip content="Clonar para outro perfil">
                                        <button
                                            onClick={() => onClone(category)}
                                            className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 rounded"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip content="Editar">
                                        <button
                                            onClick={() => onEdit(category)}
                                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </Tooltip>
                                    {canDelete && (
                                        <Tooltip content="Excluir">
                                            <button
                                                onClick={() => {
                                                    if (confirm('Tem certeza que deseja excluir?')) {
                                                        onDelete(category.id);
                                                    }
                                                }}
                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Tooltip>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
