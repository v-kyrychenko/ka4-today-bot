import type {BodyMeasurement} from '../../../../modules/telegram/commands/progress/bodyMeasurement.js';
import {
    BodyMeasurementType,
} from '../../../../modules/telegram/commands/progress/bodyMeasurementType.js';
import type {BodyMeasurementLogRow} from '../models/bodyMeasurementLogRow.js';

export const bodyMeasurementLogMapper = {
    toAppModel,
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
