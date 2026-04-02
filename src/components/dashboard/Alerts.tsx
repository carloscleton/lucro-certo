import { AlertTriangle, Clock, CalendarClock, Calendar, Tag, FileText, Bell, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Alert } from '../../hooks/useDashboard';

interface AlertsProps {
    alerts: Alert[];
}

export function Alerts({ alerts }: AlertsProps) {
    const [modalOpen, setModalOpen] = useState(false);

    if (alerts.length === 0) return null;

    const overdueAlerts = alerts.filter(a => a.type === 'overdue');
    const dueSoonAlerts = alerts.filter(a => a.type === 'due_soon');
    const recoveryAlerts = alerts.filter(a => a.type === 'recovery_due');

    const overdueTotal = overdueAlerts.reduce((acc, a) => acc + a.amount, 0);
    const dueSoonTotal = dueSoonAlerts.reduce((acc, a) => acc + a.amount, 0);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);

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
        <>
            {/* Compact Alert Bar */}
            <button
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 dark:from-red-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border border-red-200/60 dark:border-red-800/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                        <Bell size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Total count */}
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                            {alerts.length} alerta{alerts.length > 1 ? 's' : ''}
                        </span>

                        {/* Separator */}
                        <div className="w-px h-4 bg-gray-300/50 dark:bg-gray-600/50 hidden sm:block" />

                        {/* Overdue badge */}
                        {overdueAlerts.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />
                                <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                    {overdueAlerts.length} atrasada{overdueAlerts.length > 1 ? 's' : ''}
                                </span>
                                <span className="text-xs font-bold text-red-600 dark:text-red-400 hidden sm:inline">
                                    ({formatCurrency(overdueTotal)})
                                </span>
                            </div>
                        )}

                        {/* Due soon badge */}
                        {dueSoonAlerts.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                    {dueSoonAlerts.length} vence{dueSoonAlerts.length > 1 ? 'm' : ''} em breve
                                </span>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 hidden sm:inline">
                                    ({formatCurrency(dueSoonTotal)})
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                    <span className="text-xs font-semibold hidden sm:inline">Ver detalhes</span>
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
            </button>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div
                        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 relative" style={{ background: 'linear-gradient(90deg, #e11d48 0%, #f97316 100%)' }}>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/10">
                                    <Bell className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Alertas Financeiros</h2>
                                    <p className="text-white/80 text-sm mt-0.5">
                                        {alerts.length} alerta{alerts.length > 1 ? 's' : ''} encontrado{alerts.length > 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Summary Pills */}
                        <div className="flex flex-wrap gap-2 px-6 pt-5 pb-3">
                            {overdueAlerts.length > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full">
                                    <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />
                                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                        {overdueAlerts.length} atrasada{overdueAlerts.length > 1 ? 's' : ''} — {formatCurrency(overdueTotal)}
                                    </span>
                                </div>
                            )}
                            {dueSoonAlerts.length > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full">
                                    <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                        {dueSoonAlerts.length} vence{dueSoonAlerts.length > 1 ? 'm' : ''} em breve — {formatCurrency(dueSoonTotal)}
                                    </span>
                                </div>
                            )}
                            {recoveryAlerts.length > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-full">
                                    <CalendarClock size={13} className="text-pink-600 dark:text-pink-400" />
                                    <span className="text-xs font-semibold text-pink-700 dark:text-pink-300">
                                        {recoveryAlerts.length} retorno{recoveryAlerts.length > 1 ? 's' : ''} agendado{recoveryAlerts.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Alert List */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
                            {alerts.map((alert) => {
                                const config = getAlertConfig(alert.type);
                                const Icon = config.icon;

                                return (
                                    <div
                                        key={alert.id}
                                        className={`relative rounded-xl border-l-4 ${config.borderColor} ${config.bgColor} p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                                    >
                                        {/* Top: Icon + Title */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${config.iconBg}`}>
                                                    <Icon size={14} className={config.iconColor} />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${config.titleColor}`}>
                                                    {config.title}
                                                </span>
                                            </div>
                                            {alert.category_name && (
                                                <div className="flex items-center gap-1">
                                                    <Tag size={10} className="text-gray-400 dark:text-gray-500" />
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.badgeBg}`}>
                                                        {alert.category_name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Description + Amount + Date in one row */}
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                <FileText size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                                    {alert.description}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className={`text-base font-bold ${config.amountColor}`}>
                                                    {formatCurrency(alert.amount)}
                                                </span>
                                                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                                    <Calendar size={11} />
                                                    <span className="text-xs font-medium">{formatDate(alert.date)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
