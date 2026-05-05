import {
    BodyMeasurementType,
    type BodyMeasurement,
    type BodyMeasurementCreateInput,
} from '../../../../modules/telegram/features/measurements/bodyMeasurementsModel.js';
import type {BodyMeasurementLogRow} from '../models/bodyMeasurementLogRow.js';

export interface BodyMeasurementLogCreateRow {
    client_id: number;
    created_at: string;
    amount: string;
    type: string;
    unit_key: string;
}

export const bodyMeasurementLogMapper = {
    toAppModel,
    toCreateRow,
};

export function toAppModel(row: BodyMeasurementLogRow): BodyMeasurement {
    return {
        id: row.id,
        clientId: row.client_id,
        createdAt: row.created_at,
        amount: Number(row.amount),
        type: row.type as BodyMeasurementType,
        unitKey: row.unit_key,
    };
}

export function toCreateRow(input: BodyMeasurementCreateInput): BodyMeasurementLogCreateRow {
    return {
        client_id: input.clientId,
        created_at: input.createdAt,
        amount: input.amount.toFixed(1),
        type: input.type,
        unit_key: input.unitKey,
    };
}
