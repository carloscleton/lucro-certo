// Helper function to calculate next recurring dates
export function calculateNextDates(startDate: string, frequency: string, count: number = 5): Date[] {
    const dates: Date[] = [];
    // Decompose YYYY-MM-DD to avoid UTC conversion issues
    const [year, month, day] = startDate.split('-').map(Number);

    for (let i = 1; i <= count; i++) {
        // Create date in local time (month is 0-indexed)
        const nextDate = new Date(year, month - 1, day);

        if (frequency === 'weekly') {
            nextDate.setDate(nextDate.getDate() + (i * 7));
        } else if (frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + i);
        } else if (frequency === 'yearly') {
            nextDate.setFullYear(nextDate.getFullYear() + i);
        }

        dates.push(nextDate);
    }

    return dates;
}

// Helper function to format date in Brazilian format from a Date object
export function formatBrazilianDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Robustly formats a YYYY-MM-DD string into DD/MM/YYYY.
 * Bypasses timezone shifts by avoiding UTC interpretation.
 */
export function formatDateString(dateStr: string | null | undefined, includeYear: boolean = true): string {
    if (!dateStr) return '-';

    try {
        // String splitting is the safest way to avoid Date object timezone shifting
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);

        if (!year || !month || !day) return '-';

        const dayStr = day.toString().padStart(2, '0');
        const monthStr = month.toString().padStart(2, '0');

        return includeYear ? `${dayStr}/${monthStr}/${year}` : `${dayStr}/${monthStr}`;
    } catch (e) {
        return '-';
    }
}
