import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import type { Task } from '../../pages/Agenda';
import { TaskFormModal } from './TaskFormModal';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Clock, CheckSquare, Phone, Video, Mail, CreditCard, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface EntityAgendaListProps {
    leadId?: string;
    dealId?: string;
    contactId?: string;
}

export function EntityAgendaList({ leadId, dealId, contactId }: EntityAgendaListProps) {
    const { currentEntity } = useEntity();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const fetchTasks = async () => {
        if (!currentEntity?.id) return;
        setIsLoading(true);
        try {
            let query = supabase
                .from('crm_tasks')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('due_date', { ascending: true });

            if (leadId) query = query.eq('lead_id', leadId);
            if (dealId) query = query.eq('deal_id', dealId);
            if (contactId) query = query.eq('contact_id', contactId);

            const { data, error } = await query;
            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error('Error fetching entity tasks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [leadId, dealId, contactId, currentEntity.id]);

    const handleComplete = async (taskId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            const { error } = await supabase.from('crm_tasks').update({ status: newStatus }).eq('id', taskId);
            if (error) throw error;
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
        } catch (error) {
            console.error('Error toggling task status:', error);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!window.confirm('Excluir este lembrete?')) return;
        try {
            const { error } = await supabase.from('crm_tasks').delete().eq('id', taskId);
            if (error) throw error;
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const getTypeIcon = (type: string, size = 16) => {
        switch (type) {
            case 'call': return <Phone size={size} />;
            case 'meeting': return <Video size={size} />;
            case 'email': return <Mail size={size} />;
            case 'payment': return <CreditCard size={size} />;
            default: return <CheckSquare size={size} />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Lembretes & Tarefas</h4>
                <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)} className="text-sky-600 hover:bg-sky-50 -mr-2">
                    <Plus size={16} className="mr-1" /> Novo
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div>
                </div>
            ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                    <CalendarIcon className="text-gray-300 dark:text-gray-600 mb-2" size={24} />
                    <p className="text-xs font-medium text-gray-500">Sem lembretes vinculados.</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {tasks.map(task => {
                        const isPast = new Date(task.due_date) < new Date() && task.status !== 'completed';
                        return (
                            <div key={task.id} className={`p-3 rounded-xl border transition-all flex gap-3 ${task.status === 'completed' ? 'bg-gray-50 border-gray-100 opacity-60 grayscale' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <button onClick={() => handleComplete(task.id, task.status)} className={`mt-0.5 shrink-0 ${task.status === 'completed' ? 'text-emerald-500' : 'text-gray-300 hover:text-sky-500'}`}>
                                    <CheckSquare size={18} />
                                </button>
                                <div className="flex-1 overflow-hidden">
                                    <h5 className={`font-bold text-sm truncate ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                        {task.title}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${task.task_type === 'call' ? 'text-green-600' : task.task_type === 'meeting' ? 'text-purple-600' : 'text-sky-600'}`}>
                                            {getTypeIcon(task.task_type, 10)} {task.task_type}
                                        </span>
                                        <span className="text-gray-300">•</span>
                                        <span className={`text-[10px] font-medium flex items-center gap-1 ${isPast ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                                            <Clock size={10} />
                                            {format(parseISO(task.due_date), "dd/MM 'às' HH:mm")}
                                            {isPast && <span className="uppercase ml-1 animate-pulse tracking-wide">(Atrasado)</span>}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(task.id)} className="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            <TaskFormModal 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={fetchTasks}
                leadId={leadId}
                dealId={dealId}
                contactId={contactId}
            />
        </div>
    );
}
