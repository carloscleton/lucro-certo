import { useState } from 'react';
import { X, CalendarIcon, Clock, AlignLeft, Flag, Tag, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface TaskFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
    leadId?: string;
    dealId?: string;
    contactId?: string;
}

export function TaskFormModal({ isOpen, onClose, onSuccess, initialDate, leadId, dealId, contactId }: TaskFormModalProps) {
    const { currentEntity } = useEntity();
    const { user } = useAuth();
    
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        task_type: 'task',
        priority: 'medium',
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            alert('Por favor, defina um título para a tarefa.');
            return;
        }

        setIsLoading(true);
        try {
            // Unify date and time into a single TIMESTAMPTZ string
            const due_date = new Date(`${formData.date}T${formData.time}:00`).toISOString();

            const { error } = await supabase.from('crm_tasks').insert([{
                company_id: currentEntity.id,
                title: formData.title,
                description: formData.description,
                due_date,
                task_type: formData.task_type,
                priority: formData.priority,
                assigned_to: user?.id,
                status: 'pending',
                lead_id: leadId || null,
                deal_id: dealId || null,
                contact_id: contactId || null
            }]);

            if (error) throw error;
            
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Erro ao salvar tarefa:', error);
            alert('Erro ao salvar o compromisso. Verifique os dados e tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                            <CalendarIcon size={16} />
                        </div>
                        Novo Lembrete
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <form id="task-form" onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                <Tag size={16} className="text-gray-400" /> Título
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Do que você precisa se lembrar?"
                                className="w-full h-11 px-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-700 dark:text-white"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Date and Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                    <CalendarIcon size={16} className="text-gray-400" /> Data
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full h-11 px-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                    <Clock size={16} className="text-gray-400" /> Hora
                                </label>
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    className="w-full h-11 px-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 dark:text-white"
                                    required
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                <AlignLeft size={16} className="text-gray-400" /> Descrição
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detalhes adicionais (opcional)"
                                className="w-full p-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 dark:text-white min-h-[100px] resize-none"
                            />
                        </div>

                        {/* Sub Fields: Type & Priority */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                    <Tag size={16} className="text-gray-400" /> Tipo
                                </label>
                                <select
                                    value={formData.task_type}
                                    onChange={e => setFormData({ ...formData, task_type: e.target.value })}
                                    className="w-full h-11 px-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 dark:text-white"
                                >
                                    <option value="task">📝 Tarefa Simples</option>
                                    <option value="call">📞 Ligação</option>
                                    <option value="meeting">☕ Reunião Presencial</option>
                                    <option value="email">📧 Enviar E-mail</option>
                                    <option value="payment">💰 Cobrança / Pagamento</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                                    <Flag size={16} className="text-gray-400" /> Prioridade
                                </label>
                                <select
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full h-11 px-4 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 dark:text-white font-medium"
                                >
                                    <option value="low" className="text-sky-600">Baixa (Pode Esperar)</option>
                                    <option value="medium" className="text-amber-500">Média (Normal)</option>
                                    <option value="high" className="text-red-500">Alta (Urgente!)</option>
                                </select>
                            </div>
                        </div>

                        {/* TODO: In the future we will add the Lead / Contato search selection here */}
                        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 p-4 rounded-xl flex items-start gap-3 mt-4">
                            <Users size={18} className="text-sky-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-sky-800 dark:text-sky-200 uppercase tracking-wider mb-1">Integração CRM</p>
                                <p className="text-xs text-sky-600 dark:text-sky-400 leading-relaxed">
                                    Nas próximas atualizações você poderá buscar um Lead, Cliente ou Negócio para vincular a este lembrete e enviar mensagem no WhatsApp dele!
                                </p>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                    >
                        Cancelar
                    </button>
                    <Button 
                        type="submit" 
                        form="task-form" 
                        variant="primary" 
                        disabled={isLoading}
                        className="px-8 shadow-md"
                    >
                        {isLoading ? 'Salvando...' : 'Salvar Compromisso'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
