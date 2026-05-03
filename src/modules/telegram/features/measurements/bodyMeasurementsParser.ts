import {parseJsonFromText} from '../../../../shared/utils/json.js';
import {BODY_MEASUREMENT_TYPES, BodyMeasurementType} from './bodyMeasurementsModel.js';

const MAX_MEASUREMENT_VALUE = 9999.9;

export interface MeasurementDraft {
    type: BodyMeasurementType;
    value: number;
    unit: string;
}

export function parseMeasurementsReply(text: string): MeasurementDraft[] {
    try {
        const parsed = parseJsonFromText(text);
        const value = isRecord(parsed) && Array.isArray(parsed.measurements) ? parsed.measurements : parsed;
        return Array.isArray(value) ? parseMeasurementItems(value) : [];
    } catch {
        return [];
    }
}

export function mergeMeasurements(existing: MeasurementDraft[], incoming: MeasurementDraft[]): MeasurementDraft[] {
    const byType = new Map(existing.map((item) => [item.type, item]));
    incoming.forEach((item) => byType.set(item.type, item));

    return BODY_MEASUREMENT_TYPES.flatMap((type) => {
        const measurement = byType.get(type);
        return measurement ? [measurement] : [];
    });
}

export function getMissingTypes(measurements: MeasurementDraft[]): BodyMeasurementType[] {
    const existingTypes = new Set(measurements.map((item) => item.type));
    return BODY_MEASUREMENT_TYPES.filter((type) => !existingTypes.has(type));
}

export function getStoredMeasurements(data: unknown): MeasurementDraft[] {
    if (!isRecord(data) || !Array.isArray(data.measurements)) {
        return [];
    }

    return data.measurements.filter(isMeasurementDraft);
}

function parseMeasurementItems(items: unknown[]): MeasurementDraft[] {
    const seenTypes = new Set<BodyMeasurementType>();

    return items.flatMap((item) => {
        const measurement = parseMeasurement(item);
        if (!measurement || seenTypes.has(measurement.type)) {
            return [];
        }

        seenTypes.add(measurement.type);
        return [measurement];
    });
}

function parseMeasurement(value: unknown): MeasurementDraft | null {
    if (!isRecord(value)) {
        return null;
    }

    const type = parseMeasurementType(value.type);
    const amount = parseMeasurementValue(value.value);
    if (!type || amount == null) {
        return null;
    }

    const unit = typeof value.unit === 'string' ? value.unit.trim().toLowerCase() : getExpectedUnit(type);
    return unit === getExpectedUnit(type) ? {type, value: amount, unit} : null;
}

function parseMeasurementType(value: unknown): BodyMeasurementType | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return BODY_MEASUREMENT_TYPES.includes(normalized as BodyMeasurementType)
        ? normalized as BodyMeasurementType
        : null;
}

function parseMeasurementValue(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_MEASUREMENT_VALUE) {
        return null;
    }

    const normalized = Math.round(value * 10) / 10;
    return hasSingleDecimalPlace(normalized) ? normalized : null;
}

function isMeasurementDraft(value: unknown): value is MeasurementDraft {
    return (
        isRecord(value) &&
        parseMeasurementType(value.type) != null &&
        typeof value.value === 'number' &&
        typeof value.unit === 'string'
    );
}

function getExpectedUnit(type: BodyMeasurementType): string {
    return type === BodyMeasurementType.WEIGHT ? 'kg' : 'cm';
}

function hasSingleDecimalPlace(value: number): boolean {
    return Math.abs(value * 10 - Math.round(value * 10)) < Number.EPSILON * 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
