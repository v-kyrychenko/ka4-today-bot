export function parseIsoDate(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function minusDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() - days);

    return result;
}

export function nowIso(): string {
    return new Date().toISOString();
}
