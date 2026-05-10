export function parseIsoDate(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function today(): string {
    return toIsoDate(new Date());
}

export function minusDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() - days);

    return result;
}

export function calculateAge(birthday: string): number {
    const birthDate = new Date(birthday);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const hasBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= birthDate.getDate());

    if (!hasBirthdayPassed) {
        age -= 1;
    }

    return age;
}

export function getDayDistance(usedAt: string, targetDate: string): number {
    const usedTime = parseDateOnly(usedAt);
    const targetTime = parseDateOnly(targetDate);

    if (usedTime === null || targetTime === null || usedTime > targetTime) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.round((targetTime - usedTime) / 86400000);
}

export function nowIso(): string {
    return new Date().toISOString();
}

function parseDateOnly(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (!match) {
        return null;
    }

    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
