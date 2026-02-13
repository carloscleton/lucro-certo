import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, Target, Pencil, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useCRM, type CRMStage, type CRMDeal } from '../hooks/useCRM';
import { Button } from '../components/ui/Button';
import { StageModal, DealModal } from '../components/crm/CRMModals';

export function CRM() {
    const navigate = useNavigate();
    const { stages, deals, loading, deleteStage, deleteDeal, updateDealStage, updateStage } = useCRM();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    // Modal state
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<CRMStage | null>(null);
    const [editingDeal, setEditingDeal] = useState<CRMDeal | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<string | undefined>();

    const handleEditStage = (stage: CRMStage) => {
        setEditingStage(stage);
        setIsStageModalOpen(true);
    };

    const handleCreateStage = () => {
        setEditingStage(null);
        setIsStageModalOpen(true);
    };

    const handleEditDeal = (deal: CRMDeal) => {
        setEditingDeal(deal);
        setIsDealModalOpen(true);
    };

    const handleCreateDeal = (stageId?: string) => {
        setSelectedStageId(stageId);
        setEditingDeal(null);
        setIsDealModalOpen(true);
    };

    const handleDeleteStage = async (id: string) => {
        if (confirm('Deseja excluir esta etapa?')) {
            try {
                await deleteStage(id);
            } catch (err: any) {
                alert(err.message);
            }
        }
    };

    const handleDeleteDeal = async (id: string) => {
        if (confirm('Deseja excluir este negócio?')) {
            await deleteDeal(id);
        }
    };

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId, type } = result;

        if (!destination) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        // Handling Deal movement
        if (type === 'deal') {
            const dealId = draggableId;
            const newStageId = destination.droppableId;

            try {
                await updateDealStage(dealId, newStageId);

                // 🔔 Phase 4: CRM Reminders
                const stage = stages.find(s => s.id === newStageId);
                if (stage && (stage.name.toLowerCase().includes('proposta') || stage.name.toLowerCase().includes('proposal'))) {
                    if (confirm(`Negócio movido para ${stage.name}! 🚀\n\nDeseja gerar um Orçamento ou um Lançamento Financeiro para este negócio agora?`)) {
                        const choice = confirm('Pressione OK para ir para ORÇAMENTOS ou CANCELAR para CONTAS A RECEBER.')
                            ? '/quotes'
                            : '/receivables';

                        navigate(choice, { state: { dealId } });
                    }
                }
            } catch (err) {
                console.error('Failed to move deal:', err);
                alert('Erro ao mover negócio. Tente novamente.');
            }
        }

        // Handling Stage reordering
        if (type === 'stage') {
            const reorderedStages = Array.from(stages);
            const [removed] = reorderedStages.splice(source.index, 1);
            reorderedStages.splice(destination.index, 0, removed);

            try {
                // Update positions in DB sequentially or parallel
                await Promise.all(
                    reorderedStages.map((stage, index) =>
                        updateStage(stage.id, { position: index })
                    )
                );
            } catch (err) {
                console.error('Failed to reorder stages:', err);
                alert('Erro ao reordenar etapas.');
            }
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 italic animate-pulse">Carregando CRM...</div>;
    }

    if (stages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-8 shadow-inner">
                <LayoutGrid size={48} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Configure seu Funil</h3>
                <p className="text-gray-500 text-center mb-6 max-w-md italic">
                    Para começar a usar o CRM, você precisa criar as etapas do seu funil de vendas (ex: Lead, Contato, Proposta).
                </p>
                <Button onClick={handleCreateStage} className="shadow-lg shadow-blue-500/20">
                    <Plus size={18} className="mr-2" />
                    Criar Primeira Etapa
                </Button>

                <StageModal
                    isOpen={isStageModalOpen}
                    onClose={() => setIsStageModalOpen(false)}
                    stage={editingStage}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 italic">CRM / Funil de Vendas</h1>
                    <p className="text-sm text-gray-500 italic">Gerencie seus leads e oportunidades de negócio</p>
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
                    <Button variant="outline" onClick={handleCreateStage} className="hidden sm:flex">Nova Etapa</Button>
                    <Button onClick={() => handleCreateDeal()} className="shadow-lg shadow-blue-500/20">
                        <Plus size={18} className="mr-2" />
                        Novo Negócio
                    </Button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="all-stages" direction="horizontal" type="stage">
                    {(provided) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[calc(100vh-250px)] scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700"
                        >
                            {stages.map((stage, index) => (
                                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                                    {(provided) => (
                                        <div
                                            {...provided.draggableProps}
                                            ref={provided.innerRef}
                                            className="flex-shrink-0 w-80 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 flex flex-col gap-4 border border-gray-100 dark:border-slate-800/50"
                                        >
                                            <div {...provided.dragHandleProps} className="flex items-center justify-between px-1 cursor-grab active:cursor-grabbing">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                                    <h3 className="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-widest">
                                                        {stage.name}
                                                    </h3>
                                                    <span className="bg-gray-200/50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                        {deals.filter(d => d.stage_id === stage.id).length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditStage(stage)}
                                                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                        title="Editar Etapa"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStage(stage.id)}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Excluir Etapa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <Droppable droppableId={stage.id} type="deal">
                                                {(provided, snapshot) => (
                                                    <div
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className={`flex flex-col gap-3 min-h-[150px] transition-colors rounded-xl ${snapshot.isDraggingOver ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                                    >
                                                        {deals.filter(d => d.stage_id === stage.id).map((deal, dealIndex) => (
                                                            <Draggable key={deal.id} draggableId={deal.id} index={dealIndex}>
                                                                {(provided) => (
                                                                    <div
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        ref={provided.innerRef}
                                                                        onClick={() => handleEditDeal(deal)}
                                                                        className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                                                                    >
                                                                        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: stage.color }} />

                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-[13px] leading-tight group-hover:text-blue-600 transition-colors">
                                                                                {deal.title}
                                                                            </h4>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteDeal(deal.id);
                                                                                }}
                                                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>

                                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">
                                                                            {deal.description || 'Sem descrição adicional'}
                                                                        </p>

                                                                        <div className="flex items-center justify-between border-t border-gray-50 dark:border-slate-700/30 pt-3">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Valor</span>
                                                                                <span className="text-xs font-black text-gray-900 dark:text-white">
                                                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                                                                <Target size={10} className="text-blue-600 dark:text-blue-400 mr-1" />
                                                                                <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">{deal.probability}%</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>

                                            <button
                                                onClick={() => handleCreateDeal(stage.id)}
                                                className="w-full py-2.5 flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all border border-dashed border-gray-200 dark:border-slate-700 hover:border-blue-200"
                                            >
                                                <Plus size={14} />
                                                Adicionar Negócio
                                            </button>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}

                            <button
                                onClick={handleCreateStage}
                                className="flex-shrink-0 w-80 h-14 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700/50 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all group font-bold text-xs uppercase tracking-widest"
                            >
                                <Plus size={18} className="mr-2 group-hover:scale-110 transition-transform" />
                                Nova Etapa
                            </button>
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <StageModal
                isOpen={isStageModalOpen}
                onClose={() => setIsStageModalOpen(false)}
                stage={editingStage}
            />

            <DealModal
                isOpen={isDealModalOpen}
                onClose={() => setIsDealModalOpen(false)}
                deal={editingDeal}
                initialStageId={selectedStageId}
            />
        </div>
    );
}
