import type { Category } from '../../hooks/useCategories';

interface BudgetProgressProps {
    categories: Category[];
    expenses: { category_id: string; amount: number }[];
}

export function BudgetProgress({ categories, expenses }: BudgetProgressProps) {
    // Filter categories that have a budget limit
    const budgetCategories = categories.filter(c => c.budget_limit && c.budget_limit > 0);

    if (budgetCategories.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Metas Mensais</h3>
            <div className="space-y-4">
                {budgetCategories.map(category => {
                    const spent = expenses
                        .filter(e => e.category_id === category.id)
                        .reduce((acc, curr) => acc + curr.amount, 0);

                    const limit = category.budget_limit || 0;
                    const percentage = Math.min((spent / limit) * 100, 100);
                    const isOverBudget = spent > limit;

                    // Color logic
                    let colorClass = 'bg-green-500';
                    if (percentage > 80) colorClass = 'bg-yellow-500';
                    if (percentage >= 100) colorClass = 'bg-red-500';

                    return (
                        <div key={category.id}>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{category.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spent)} / {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limit)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
                                <div
                                    className={`h-2.5 rounded-full transition-all duration-500 ${colorClass}`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            {isOverBudget && (
                                <p className="text-xs text-red-500 mt-1">Acima da meta!</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
