import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
    id: string;
    type: NotificationType;
    title?: string;
    message: string;
}

interface NotificationContextType {
    notify: (type: NotificationType, message: string, title?: string) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const notify = useCallback((type: NotificationType, message: string, title?: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications((prev) => [...prev, { id, type, message, title }]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ notify, removeNotification }}>
            {children}

            {/* Container de Notificações */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm">
                {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} onDismiss={removeNotification} />
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
    const icons = {
        success: <CheckCircle2 className="text-emerald-500" size={24} />,
        error: <XCircle className="text-red-500" size={24} />,
        warning: <AlertCircle className="text-yellow-500" size={24} />,
        info: <Info className="text-blue-500" size={24} />,
    };

    const styles = {
        success: 'border-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/30',
        error: 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-900/30',
        warning: 'border-yellow-100 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-900/30',
        info: 'border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-900/30',
    };

    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border shadow-xl animate-in slide-in-from-right fade-in duration-300 ${styles[notification.type]}`}>
            <div className="flex-shrink-0">
                {icons[notification.type]}
            </div>
            <div className="flex-1">
                {notification.title && (
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {notification.title}
                    </h4>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    {notification.message}
                </p>
            </div>
            <button
                onClick={() => onDismiss(notification.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
                <X size={18} />
            </button>
        </div>
    );
}
