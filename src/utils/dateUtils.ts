// Helper function to calculate next recurring dates
export function calculateNextDates(startDate: string, frequency: string, count: number = 5): Date[] {
    const dates: Date[] = [];
    const start = new Date(startDate);

    for (let i = 1; i <= count; i++) {
        const nextDate = new Date(start);

        if (frequency === 'weekly') {
            nextDate.setDate(start.getDate() + (i * 7));
        } else if (frequency === 'monthly') {
            nextDate.setMonth(start.getMonth() + i);
        } else if (frequency === 'yearly') {
            nextDate.setFullYear(start.getFullYear() + i);
        }

        dates.push(nextDate);
    }

    return dates;
}

// Helper function to format date in Brazilian format
export function formatBrazilianDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
