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

export const BODY_MEASUREMENT_TREND_CONFIG = {
    [BodyMeasurementType.WEIGHT]: TrendDirection.DOWN,
    [BodyMeasurementType.WAIST]: TrendDirection.DOWN,
    [BodyMeasurementType.CHEST]: TrendDirection.UP,
    [BodyMeasurementType.HIPS]: TrendDirection.DOWN,
    [BodyMeasurementType.THIGH]: TrendDirection.DOWN,
    [BodyMeasurementType.CALF]: TrendDirection.UP,
    [BodyMeasurementType.BICEPS]: TrendDirection.UP,
} as const;
