export function parseIsoDate(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function toIsoDateInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const partValues = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${partValues.year}-${partValues.month}-${partValues.day}`;
}

export function minusDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() - days);

    return result;
}

export function nowIso(): string {
    return new Date().toISOString();
}
