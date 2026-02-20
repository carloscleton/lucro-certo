import { AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import type { Alert } from '../../hooks/useDashboard';

interface AlertsProps {
    alerts: Alert[];
}

export function Alerts({ alerts }: AlertsProps) {
    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {alerts.map((alert) => {
                let styles = '';
                let icon = null;
                let title = '';

                switch (alert.type) {
                    case 'overdue':
                        styles = 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-300';
                        icon = <AlertTriangle size={20} />;
                        title = 'Conta Atrasada';
                        break;
                    case 'due_soon':
                        styles = 'bg-yellow-50 border-yellow-500 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300';
                        icon = <Clock size={20} />;
                        title = 'Vence em breve';
                        break;
                    case 'recovery_due':
                        styles = 'bg-pink-50 border-pink-500 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300';
                        icon = <CalendarClock size={20} />;
                        title = 'Retorno Agendado (Recuperação)';
                        break;
                }

                return (
                    <div
                        key={alert.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-sm ${styles}`}
                    >
                        <div className="mt-0.5">
                            {icon}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <p className="font-medium">{title}</p>
                                {alert.category_name && (
                                    <span className="text-xs bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                        {alert.category_name}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-sm">{alert.description}</span>
                                <span className="font-bold">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alert.amount)}
                                </span>
                            </div>
                            <p className="text-xs opacity-80 mt-1">
                                Data: {alert.date && alert.date.includes('-') ? alert.date.split('-').reverse().join('/') : alert.date}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
