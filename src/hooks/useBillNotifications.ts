import { useEffect, useRef } from 'react';
import { useUpcomingBills } from './useUpcomingBills';

const NOTIFICATION_KEY = 'lucro-certo:last-bill-notification';

export function useBillNotifications() {
    const { bills } = useUpcomingBills(3); // Next 3 days
    const hasNotified = useRef(false);

    useEffect(() => {
        if (hasNotified.current) return;

        // Check if we already notified today
        const today = new Date().toISOString().split('T')[0];
        const lastNotification = localStorage.getItem(NOTIFICATION_KEY);
        if (lastNotification === today) return;

        const allBills = [...bills.overdue, ...bills.thisWeek];
        if (allBills.length === 0) return;

        // Request permission
        if (!('Notification' in window)) return;

        const sendNotification = () => {
            const overdueCount = bills.overdue.length;
            const dueSoonCount = bills.thisWeek.length;

            let title = '💰 Lucro Certo';
            let body = '';

            if (overdueCount > 0 && dueSoonCount > 0) {
                body = `Você tem ${overdueCount} conta(s) atrasada(s) e ${dueSoonCount} vencendo em breve!`;
            } else if (overdueCount > 0) {
                body = `Atenção! ${overdueCount} conta(s) atrasada(s) aguardando pagamento.`;
            } else {
                body = `${dueSoonCount} conta(s) vencem nos próximos 3 dias.`;
            }

            new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'bill-reminder',
            });

            localStorage.setItem(NOTIFICATION_KEY, today);
            hasNotified.current = true;
        };

        if (Notification.permission === 'granted') {
            sendNotification();
        }
        // Notification permission MUST be requested via user gesture (button click).
        // Automation in useEffect results in browser violations.
    }, [bills]);
}
