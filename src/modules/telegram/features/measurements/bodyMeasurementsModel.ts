import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';

export const CONVERSATION_TYPE_BODY_MEASUREMENTS = 'BODY_MEASUREMENTS';
export type ConversationType = typeof CONVERSATION_TYPE_BODY_MEASUREMENTS;

export interface BodyMeasurement {
    id: number;
    clientId: number;
    createdAt: string;
    amount: number;
    type: BodyMeasurementType;
    unitKey: string;
}

export interface BodyMeasurementCreateInput {
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
    //CALF = 'CALF',
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
    //BodyMeasurementType.CALF,
    BodyMeasurementType.BICEPS,
] as const satisfies readonly BodyMeasurementType[];

export const BODY_MEASUREMENT_METRIC_I18N_KEYS = {
    [BodyMeasurementType.WEIGHT]: I18N_KEYS.telegram.progress.metric.weight,
    [BodyMeasurementType.WAIST]: I18N_KEYS.telegram.progress.metric.waist,
    [BodyMeasurementType.CHEST]: I18N_KEYS.telegram.progress.metric.chest,
    [BodyMeasurementType.HIPS]: I18N_KEYS.telegram.progress.metric.hips,
    [BodyMeasurementType.THIGH]: I18N_KEYS.telegram.progress.metric.thigh,
    //[BodyMeasurementType.CALF]: I18N_KEYS.telegram.progress.metric.calf,
    [BodyMeasurementType.BICEPS]: I18N_KEYS.telegram.progress.metric.biceps,
} as const satisfies Record<BodyMeasurementType, string>;

export function getExpectedBodyMeasurementUnit(type: BodyMeasurementType): string {
    return type === BodyMeasurementType.WEIGHT ? 'kg' : 'cm';
}

//TODO trend should be user oriented, should be moved to DB (client.goals)
export const BODY_MEASUREMENT_TREND_CONFIG = {
    [BodyMeasurementType.WEIGHT]: TrendDirection.DOWN,
    [BodyMeasurementType.WAIST]: TrendDirection.DOWN,
    [BodyMeasurementType.CHEST]: TrendDirection.UP,
    [BodyMeasurementType.HIPS]: TrendDirection.DOWN,
    [BodyMeasurementType.THIGH]: TrendDirection.DOWN,
    //[BodyMeasurementType.CALF]: TrendDirection.UP,
    [BodyMeasurementType.BICEPS]: TrendDirection.UP,
} as const;
