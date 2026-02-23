import { AlertTriangle, Clock, CalendarClock, Calendar, Tag, FileText } from 'lucide-react';
import type { Alert } from '../../hooks/useDashboard';

interface AlertsProps {
    alerts: Alert[];
}

export function Alerts({ alerts }: AlertsProps) {
    if (alerts.length === 0) return null;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const getAlertConfig = (type: Alert['type']) => {
        switch (type) {
            case 'overdue':
                return {
                    icon: AlertTriangle,
                    title: 'Conta Atrasada',
                    borderColor: 'border-red-500',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    iconBg: 'bg-red-100 dark:bg-red-900/40',
                    iconColor: 'text-red-600 dark:text-red-400',
                    titleColor: 'text-red-700 dark:text-red-300',
                    amountColor: 'text-red-700 dark:text-red-300',
                    badgeBg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                };
            case 'due_soon':
                return {
                    icon: Clock,
                    title: 'Vence em Breve',
                    borderColor: 'border-amber-500',
                    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
                    iconColor: 'text-amber-600 dark:text-amber-400',
                    titleColor: 'text-amber-700 dark:text-amber-300',
                    amountColor: 'text-amber-700 dark:text-amber-300',
                    badgeBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                };
            case 'recovery_due':
                return {
                    icon: CalendarClock,
                    title: 'Retorno Agendado',
                    borderColor: 'border-pink-500',
                    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
                    iconBg: 'bg-pink-100 dark:bg-pink-900/40',
                    iconColor: 'text-pink-600 dark:text-pink-400',
                    titleColor: 'text-pink-700 dark:text-pink-300',
                    amountColor: 'text-pink-700 dark:text-pink-300',
                    badgeBg: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
                };
        }
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Alertas
                    </h3>
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                        {alerts.length}
                    </span>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {alerts.map((alert) => {
                    const config = getAlertConfig(alert.type);
                    const Icon = config.icon;

                    return (
                        <div
                            key={alert.id}
                            className={`relative rounded-xl border-l-4 ${config.borderColor} ${config.bgColor} p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group`}
                        >
                            {/* Top row: Icon + Title + Badge */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${config.iconBg}`}>
                                        <Icon size={16} className={config.iconColor} />
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-wide ${config.titleColor}`}>
                                        {config.title}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex items-center gap-1.5 mb-2">
                                <FileText size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={alert.description}>
                                    {alert.description}
                                </p>
                            </div>

                            {/* Amount */}
                            <div className="mb-3">
                                <span className={`text-lg font-bold ${config.amountColor}`}>
                                    {formatCurrency(alert.amount)}
                                </span>
                            </div>

                            {/* Footer: Date + Category */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={12} className="text-gray-400 dark:text-gray-500" />
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {formatDate(alert.date)}
                                    </span>
                                </div>
                                {alert.category_name && (
                                    <div className="flex items-center gap-1">
                                        <Tag size={11} className="text-gray-400 dark:text-gray-500" />
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.badgeBg}`}>
                                            {alert.category_name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
