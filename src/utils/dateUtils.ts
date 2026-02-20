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

// Helper function to format date in Brazilian format
export function formatBrazilianDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
