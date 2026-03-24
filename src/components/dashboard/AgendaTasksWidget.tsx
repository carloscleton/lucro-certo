import { Calendar, Clock, CheckSquare, Phone, Video, Mail, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface AgendaTasksWidgetProps {
    tasks: any[];
}

export function AgendaTasksWidget({ tasks }: AgendaTasksWidgetProps) {
    const navigate = useNavigate();

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'call': return <Phone size={14} className="text-emerald-500" />;
            case 'meeting': return <Video size={14} className="text-purple-500" />;
            case 'email': return <Mail size={14} className="text-blue-500" />;
            default: return <CheckSquare size={14} className="text-amber-500" />;
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calendar size={20} className="text-sky-500" />
                        Agenda & Compromissos
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Suas próximas tarefas pendentes</p>
                </div>
                <button 
                    onClick={() => navigate('/agenda')}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg text-sky-600 transition-colors"
                >
                    <ArrowRight size={20} />
                </button>
            </div>

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-gray-50 dark:border-slate-700/50 rounded-2xl">
                        <Calendar className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                        <p className="text-sm text-gray-400">Tudo em dia! Nenhuma tarefa pendente.</p>
                    </div>
                ) : (
                    tasks.map((task) => {
                        const isPast = new Date(task.due_date) < new Date();
                        const leadData = Array.isArray(task.lead) ? task.lead[0] : task.lead;
                        const dealData = Array.isArray(task.deal) ? task.deal[0] : task.deal;
                        const contactData = Array.isArray(task.contact) ? task.contact[0] : task.contact;
                        const relatedName = leadData?.name || contactData?.name || dealData?.title;

                        return (
                            <div 
                                key={task.id} 
                                className="group flex items-start gap-4 p-3 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
                                onClick={() => navigate('/agenda')}
                            >
                                <div className="mt-1 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    {getTypeIcon(task.task_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-sky-600 transition-colors">
                                            {task.title}
                                        </h4>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${isPast ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                                            {isPast ? 'ATRASADO' : 'EM BREVE'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                            <Clock size={10} />
                                            {format(parseISO(task.due_date), "dd/MM 'às' HH:mm")}
                                        </div>
                                        {relatedName && (
                                            <>
                                                <span className="text-gray-300 dark:text-gray-700">•</span>
                                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                                                    {relatedName}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {tasks.length > 0 && (
                <button 
                    onClick={() => navigate('/agenda')}
                    className="w-full mt-4 py-2 text-xs font-bold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/10 rounded-lg transition-all"
                >
                    Ver Agenda Completa
                </button>
            )}
        </div>
    );
}
