import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LayoutGrid, Target, Wand2, RefreshCw, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useCRM, type CRMStage, type CRMDeal } from '../../hooks/useCRM';
import { useContacts } from '../../hooks/useContacts';
import { EntityAgendaList } from '../agenda/EntityAgendaList';

interface StageModalProps {
    isOpen: boolean;
    onClose: () => void;
    stage?: CRMStage | null;
}

export function StageModal({ isOpen, onClose, stage }: StageModalProps) {
    const { addStage, updateStage } = useCRM();
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3b82f6'); // Default blue
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (stage) {
            setName(stage.name);
            setColor(stage.color);
        } else {
            setName('');
            setColor('#3b82f6');
        }
    }, [stage, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (stage) {
                await updateStage(stage.id, { name, color });
            } else {
                await addStage({ name, color, position: 0 });
            }
            onClose();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={stage ? 'Editar Etapa' : 'Nova Etapa'}
            subtitle="Defina o nome e cor da fase do seu funil"
            icon={LayoutGrid}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Nome da Etapa"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Lead, Negociação..."
                    required
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cor da Etapa
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-10 w-20 rounded border border-gray-200 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="text-sm text-gray-500 uppercase">{color}</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                    <Button type="submit" isLoading={saving}>
                        {stage ? 'Salvar Alterações' : 'Criar Etapa'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal?: CRMDeal | null;
    initialStageId?: string;
}

export function DealModal({ isOpen, onClose, deal, initialStageId }: DealModalProps) {
    const navigate = useNavigate();
    const { addDeal, updateDeal, stages } = useCRM();
    const { contacts } = useContacts();

    const [title, setTitle] = useState('');
    const [value, setValue] = useState(0);
    const [stageId, setStageId] = useState('');
    const [contactId, setContactId] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleMagicSuggestion = async () => {
        if (!description && !title) {
            alert('Por favor, descreva um pouco o negócio ou o título para que a IA possa ajudar.');
            return;
        }

        setIsGenerating(true);
        try {
            const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
                body: {
                    input: `Título: ${title}. Descrição Atual: ${description}. Sugira uma abordagem de vendas ou aprimore esta descrição para torná-la mais profissional e estratégica.`,
                    mode: 'field_only'
                }
            });

            if (error) throw error;
            if (data?.text) {
                setDescription(data.text);
            }
        } catch (error) {
            console.error('Magic error:', error);
            alert('Falha ao gerar sugestão. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (deal) {
            setTitle(deal.title);
            setValue(deal.value);
            setStageId(deal.stage_id || '');
            setContactId(deal.contact_id || '');
            setDescription(deal.description || '');
        } else {
            setTitle('');
            setValue(0);
            setStageId(initialStageId || (stages[0]?.id || ''));
            setContactId('');
            setDescription('');
        }
    }, [deal, initialStageId, stages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const dealData = {
                title,
                value,
                stage_id: stageId || null,
                contact_id: contactId || null,
                description,
                status: 'active' as const,
                probability: 50,
                tags: []
            };

            if (deal) {
                await updateDeal(deal.id, dealData);
            } else {
                await addDeal(dealData);
            }
            onClose();
        } catch (error: any) {
            alert('Erro: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateProposal = () => {
        if (!deal) return;
        const params = new URLSearchParams({
            dealId: deal.id,
            contactId: deal.contact_id || '',
            title: deal.title,
            amount: deal.value.toString()
        });
        navigate(`/dashboard/quotes/new?${params.toString()}`);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={deal ? 'Editar Negócio' : 'Novo Negócio'}
            subtitle="Registre uma oportunidade de venda"
            icon={Target}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Título do Negócio"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Venda de Software..."
                    required
                />

                <div className="grid grid-cols-2 gap-4">
                    <CurrencyInput
                        label="Valor (R$)"
                        value={value}
                        onChange={(num) => setValue(num)}
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Etapa do Funil
                        </label>
                        <select
                            value={stageId}
                            onChange={(e) => setStageId(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            required
                        >
                            <option value="">Selecione uma etapa</option>
                            {stages.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contato / Cliente
                    </label>
                    <select
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                        <option value="">Nenhum contato selecionado</option>
                        {contacts.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Descrição / Notas
                        </label>
                        <button
                            type="button"
                            onClick={handleMagicSuggestion}
                            disabled={isGenerating}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 p-1 rounded hover:bg-blue-50 transition-colors"
                        >
                            {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                            {isGenerating ? 'Pensando...' : 'Magia IA'}
                        </button>
                    </div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24"
                        placeholder="Detalhes sobre a negociação..."
                    />
                </div>

                <div className="flex justify-between items-center pt-4">
                    {deal && (
                        <Button type="button" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-2" onClick={handleCreateProposal}>
                            <FileText size={18} />
                            Gerar Proposta
                        </Button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                        <Button type="submit" isLoading={saving}>
                            {deal ? 'Salvar Alterações' : 'Criar Negócio'}
                        </Button>
                    </div>
                </div>
            </form>

            {deal && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
                    <EntityAgendaList dealId={deal.id} contactId={deal.contact_id || undefined} />
                </div>
            )}
        </Modal>
    );
}
