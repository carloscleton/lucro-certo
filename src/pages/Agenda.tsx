import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    Clock, 
    Phone, 
    Mail, 
    Video, 
    CheckSquare, 
    CreditCard,
    Trash2,
    CheckCircle2,
    Circle,
    User,
    Briefcase
} from 'lucide-react';
import { 
    format, 
    addMonths, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    isSameMonth, 
    isSameDay, 
    addDays,
    parseISO,
    isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { TaskFormModal } from '../components/agenda/TaskFormModal';

// Types
export interface Task {
    id: string;
    title: string;
    description: string;
    due_date: string;
    task_type: 'call' | 'meeting' | 'email' | 'task' | 'payment' | 'other';
    status: 'pending' | 'in_progress' | 'completed' | 'canceled';
    priority: 'low' | 'medium' | 'high';
    assigned_to: string;
    contact_id?: string;
    lead_id?: string;
    deal_id?: string;
    created_at: string;
}

export function Agenda() {
    const { t } = useTranslation();
    const { currentEntity } = useEntity();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const fetchTasks = async () => {
        if (!currentEntity?.id) return;
        setIsLoading(true);
        try {
            const monthStart = startOfMonth(currentMonth);
            const startDate = startOfWeek(monthStart);
            const monthEnd = endOfMonth(currentMonth);
            const endDate = endOfWeek(monthEnd);

            const { data, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('company_id', currentEntity.id)
                .gte('due_date', startDate.toISOString())
                .lte('due_date', endDate.toISOString())
                .order('due_date', { ascending: true });

            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [currentMonth, currentEntity.id]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const onDateClick = (day: Date) => setSelectedDate(day);

    const toggleTaskComplete = async (taskId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            const { error } = await supabase
                .from('crm_tasks')
                .update({ status: newStatus })
                .eq('id', taskId);

            if (error) throw error;
            fetchTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const deleteTask = async (taskId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;
            fetchTasks();
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

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                        <CalendarIcon className="text-sky-600 dark:text-sky-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white capitalize tracking-tight">
                            {format(currentMonth, 'MMMM', { locale: ptBR })}
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{format(currentMonth, 'yyyy')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                        <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 transition-colors shadow-sm">
                        {t('agenda_module.today')}
                    </button>
                    <button onClick={nextMonth} className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                        <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <Button onClick={() => setIsFormOpen(true)} className="ml-2 shadow-lg shadow-sky-500/20 gap-2 font-bold px-6" variant="primary">
                        <Plus size={18} /> {t('agenda_module.new_reminder')}
                    </Button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        let startDate = startOfWeek(currentMonth);
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="flex justify-center flex-1 py-4">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        {format(addDays(startDate, i), 'EEEEEE', { locale: ptBR })}
                    </span>
                </div>
            );
        }
        return <div className="flex bg-gray-50/80 dark:bg-slate-900/40 border-b border-gray-100 dark:border-slate-700/50 backdrop-blur-sm sticky top-0 z-10">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const dayIsToday = isToday(day);
                
                const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), cloneDay));

                days.push(
                    <div
                        className={`min-h-[100px] p-2 border-r border-b border-gray-100 dark:border-slate-700/50 relative group cursor-pointer transition-all flex-1
                            ${!isCurrentMonth ? 'bg-gray-50/30 dark:bg-slate-900/20 text-gray-400' : 'bg-white dark:bg-slate-800'}
                            ${isSelected ? 'ring-2 ring-inset ring-sky-500 bg-sky-50/20 dark:bg-sky-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}
                        `}
                        key={day.toISOString()}
                        onClick={() => onDateClick(cloneDay)}
                    >
                        <div className="flex justify-between items-start">
                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors
                                ${dayIsToday ? 'bg-sky-500 text-white shadow-md' : 
                                  isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {formattedDate}
                            </span>
                            {dayTasks.length > 0 && (
                                <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 px-1.5 py-0.5 rounded-md">
                                    {dayTasks.length}
                                </span>
                            )}
                        </div>
                        
                        <div className="mt-2 space-y-1">
                            {dayTasks.slice(0, 3).map(task => (
                                <div key={task.id} className={`text-[10px] font-medium truncate px-1.5 py-0.5 rounded flex items-center gap-1 ${task.status === 'completed' ? 'opacity-50 line-through bg-gray-100 text-gray-500' : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'}`}>
                                    {getTypeIcon(task.task_type, 10)}
                                    <span className="truncate">{task.title}</span>
                                </div>
                            ))}
                            {dayTasks.length > 3 && (
                                <div className="text-[10px] font-medium text-gray-400 pl-1">
                                    +{dayTasks.length - 3} mais
                                </div>
                            )}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="flex w-full" key={day.toISOString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="flex flex-col border-l border-t border-gray-100 dark:border-slate-700/50 flex-1 overflow-y-auto scrollbar-thin">{rows}</div>;
    };

    const renderSidebar = () => {
        const dayTasks = tasks.filter(t => isSameDay(parseISO(t.due_date), selectedDate))
                               .sort((a,b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        return (
            <div className="w-96 flex-shrink-0 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-700 flex flex-col h-full animate-in slide-in-from-right duration-500">
                <div className="mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white capitalize tracking-tight">
                            {format(selectedDate, 'EEEE', { locale: ptBR })}
                        </h3>
                        {isToday(selectedDate) && (
                            <span className="bg-sky-500 text-white text-[10px] py-1 px-3 rounded-full font-black shadow-md shadow-sky-500/20">
                                {t('agenda_module.today')}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 scrollbar-thin">
                    {dayTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-slate-700/50">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                                <Clock className="text-gray-300 dark:text-gray-600" size={32} />
                            </div>
                            <p className="text-sm font-bold text-gray-400 mb-1">{t('agenda_module.no_tasks')}</p>
                            <p className="text-xs text-gray-400 italic mb-6">{t('agenda_module.no_tasks_desc')}</p>
                            <Button onClick={() => setIsFormOpen(true)} className="text-xs font-bold" variant="outline">
                                <Plus size={14} className="mr-1" /> {t('agenda_module.new_reminder')}
                            </Button>
                        </div>
                    ) : (
                        dayTasks.map(task => {
                            const isPast = new Date(task.due_date) < new Date() && task.status !== 'completed';
                            const isCompleted = task.status === 'completed';
                            
                            return (
                                <div 
                                    key={task.id} 
                                    className={`group bg-white dark:bg-slate-800 border rounded-2.5xl p-4 transition-all duration-300 relative overflow-hidden
                                        ${isCompleted ? 'opacity-60 border-gray-100 dark:border-slate-800' : 'border-gray-100 dark:border-slate-700 hover:border-sky-200 dark:hover:border-sky-800 hover:shadow-lg hover:shadow-gray-200/40 dark:hover:shadow-none hover:-translate-y-0.5'}
                                    `}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${
                                        isCompleted ? 'bg-emerald-500' : 
                                        task.priority === 'high' ? 'bg-red-500' : 
                                        task.priority === 'medium' ? 'bg-amber-500' : 'bg-sky-500'
                                    }`} />
                                    
                                    <div className="flex items-start gap-3">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.status); }}
                                            className={`mt-1 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-gray-300 hover:text-sky-500'}`}
                                        >
                                            {isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-[0.1em] border
                                                    ${task.task_type === 'meeting' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                                                      task.task_type === 'call' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                      task.task_type === 'payment' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                                      task.task_type === 'email' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                      'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                                    {task.task_type}
                                                </span>
                                                {isPast && (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100 animate-pulse">
                                                        ATRASADO
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <h4 className={`font-black text-[13px] leading-snug transition-all ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                {task.title}
                                            </h4>
                                            
                                            {task.description && (
                                                <p className="text-[11px] text-gray-500 mt-1 lines-clamp-2 leading-relaxed italic">{task.description}</p>
                                            )}
                                            
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded">
                                                        <Clock size={12} className="text-sky-500" />
                                                        {format(parseISO(task.due_date), "HH:mm")}
                                                    </div>
                                                    {(task.lead_id || task.deal_id || task.contact_id) && (
                                                        <div className="flex -space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            {task.contact_id && <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center ring-2 ring-white dark:ring-slate-800"><User size={10} className="text-blue-600" /></div>}
                                                            {task.deal_id && <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center ring-2 ring-white dark:ring-slate-800"><Briefcase size={10} className="text-amber-600" /></div>}
                                                        </div>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 h-full flex flex-col max-w-[1600px] mx-auto animate-in fade-in duration-500 overflow-hidden">
            {renderHeader()}
            
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
                    {renderDays()}
                    <div className="flex-1 w-full overflow-hidden flex flex-col">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
                            </div>
                        ) : (
                            renderCells()
                        )}
                    </div>
                </div>

                {renderSidebar()}
            </div>

            <TaskFormModal 
                isOpen={isFormOpen} 
                onClose={() => setIsFormOpen(false)} 
                onSuccess={() => {
                    fetchTasks();
                }}
                initialDate={selectedDate}
            />
        </div>
    );
}
