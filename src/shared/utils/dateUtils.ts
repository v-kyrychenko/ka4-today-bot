export function parseIsoDate(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

