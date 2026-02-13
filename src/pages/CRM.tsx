import { useState } from 'react';
import { Plus, MoreVertical, LayoutGrid, List } from 'lucide-react';
import { useCRM } from '../hooks/useCRM';
import { Button } from '../components/ui/Button';

export function CRM() {
    const { stages, deals, loading } = useCRM();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    if (loading) {
        return <div className="flex items-center justify-center h-64">Carregando CRM...</div>;
    }

    if (stages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-8">
                <LayoutGrid size={48} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Configure seu Funil</h3>
                <p className="text-gray-500 text-center mb-6 max-w-md">
                    Para começar a usar o CRM, você precisa criar as etapas do seu funil de vendas (ex: Lead, Contato, Proposta).
                </p>
                <Button>
                    <Plus size={18} className="mr-2" />
                    Criar Primeira Etapa
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM / Funil de Vendas</h1>
                    <p className="text-sm text-gray-500">Gerencie seus leads e oportunidades de negócio</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex outline-none border border-gray-200 dark:border-slate-700">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                    <Button variant="outline">Configurar Fases</Button>
                    <Button>
                        <Plus size={18} className="mr-2" />
                        Novo Negócio
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[calc(100vh-250px)]">
                {stages.map(stage => (
                    <div key={stage.id} className="flex-shrink-0 w-80 bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-4 rounded-full" style={{ backgroundColor: stage.color }} />
                                <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">
                                    {stage.name}
                                </h3>
                                <span className="bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                    {deals.filter(d => d.stage_id === stage.id).length}
                                </span>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                                <MoreVertical size={16} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 min-h-[100px]">
                            {deals.filter(d => d.stage_id === stage.id).map(deal => (
                                <div key={deal.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all cursor-pointer group">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                                        {deal.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                        {deal.description || 'Sem descrição'}
                                    </p>
                                    <div className="flex items-center justify-between border-t border-gray-50 dark:border-slate-700/50 pt-2">
                                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                        </span>
                                        <div className="flex -space-x-1">
                                            {/* Placeholder for tags/assigned user */}
                                            <div className="w-5 h-5 rounded-full bg-gray-100 border border-white dark:border-slate-800 flex items-center justify-center text-[8px] font-bold">
                                                CC
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="w-full py-2 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700">
                            <Plus size={14} />
                            Adicionar Negócio
                        </button>
                    </div>
                ))}

                <button className="flex-shrink-0 w-80 h-12 bg-gray-50 dark:bg-slate-900/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
                    <Plus size={20} className="mr-2" />
                    Nova Etapa
                </button>
            </div>
        </div>
    );
}
