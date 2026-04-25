const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function getCurrentDayCode(date = new Date()): string {
    return DAYS_SHORT[date.getDay()] ?? 'SUN';
}
