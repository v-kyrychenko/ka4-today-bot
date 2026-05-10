export function toSet(values: string[]): Set<string> {
    return new Set(values.filter(Boolean));
}

export function intersects(values: Iterable<string>, target: Set<string>): boolean {
    for (const value of values) {
        if (target.has(value)) {
            return true;
        }
    }

    return false;
}
