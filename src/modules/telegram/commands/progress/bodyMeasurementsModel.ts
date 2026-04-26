export interface BodyMeasurement {
    id: number;
    clientId: number;
    createdAt: string;
    amount: number;
    type: BodyMeasurementType;
    unitKey: string;
}

export interface BodyMeasurementSummary {
    id: number;
    clientId: number;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    dataHash: string;
    summaryText: string;
    summaryPng: Buffer;
}

export interface BodyMeasurementSummaryCreateInput {
    clientId: number;
    periodStart: string;
    periodEnd: string;
    dataHash: string;
    summaryText: string;
    summaryPng: Buffer;
}

export enum BodyMeasurementType {
    WEIGHT = 'WEIGHT',
    WAIST = 'WAIST',
    CHEST = 'CHEST',
    HIPS = 'HIPS',
    THIGH = 'THIGH',
    CALF = 'CALF',
    BICEPS = 'BICEPS',
}

export enum TrendDirection {
    UP = 'UP',
    DOWN = 'DOWN',
    NEUTRAL = 'NEUTRAL',
}

export const BODY_MEASUREMENT_TYPES = [
    BodyMeasurementType.WEIGHT,
    BodyMeasurementType.WAIST,
    BodyMeasurementType.CHEST,
    BodyMeasurementType.HIPS,
    BodyMeasurementType.THIGH,
    BodyMeasurementType.CALF,
    BodyMeasurementType.BICEPS,
] as const;

//TODO trend should be user oriented, should be moved to DB (client.goals)
export const BODY_MEASUREMENT_TREND_CONFIG = {
    [BodyMeasurementType.WEIGHT]: TrendDirection.DOWN,
    [BodyMeasurementType.WAIST]: TrendDirection.DOWN,
    [BodyMeasurementType.CHEST]: TrendDirection.UP,
    [BodyMeasurementType.HIPS]: TrendDirection.DOWN,
    [BodyMeasurementType.THIGH]: TrendDirection.DOWN,
    [BodyMeasurementType.CALF]: TrendDirection.UP,
    [BodyMeasurementType.BICEPS]: TrendDirection.UP,
} as const;

