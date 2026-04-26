export enum BodyMeasurementType {
    WEIGHT = 'WEIGHT',
    WAIST = 'WAIST',
    CHEST = 'CHEST',
    THIGH = 'THIGH',
    CALF = 'CALF',
    BICEPS = 'BICEPS',
}

export const BODY_MEASUREMENT_TYPES = [
    BodyMeasurementType.WEIGHT,
    BodyMeasurementType.WAIST,
    BodyMeasurementType.CHEST,
    BodyMeasurementType.THIGH,
    BodyMeasurementType.CALF,
    BodyMeasurementType.BICEPS,
] as const;
