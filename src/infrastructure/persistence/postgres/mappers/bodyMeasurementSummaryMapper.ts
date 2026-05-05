import type {
    BodyMeasurementSummary,
    BodyMeasurementSummaryCreateInput,
} from '../../../../modules/telegram/features/measurements/bodyMeasurementsModel.js';
import type {BodyMeasurementSummaryRow} from '../models/bodyMeasurementSummaryRow.js';

export interface BodyMeasurementSummaryCreateRow {
    client_id: number;
    created_at: string;
    period_start: string;
    period_end: string;
    data_hash: string;
    summary_text: string;
    summary_png: Buffer;
}

export const bodyMeasurementSummaryMapper = {
    toAppModel,
    toCreateRow,
};

export function toAppModel(row: BodyMeasurementSummaryRow): BodyMeasurementSummary {
    return {
        id: row.id,
        clientId: row.client_id,
        createdAt: row.created_at,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        dataHash: row.data_hash,
        summaryText: row.summary_text,
        summaryPng: row.summary_png,
    };
}

export function toCreateRow(
    input: BodyMeasurementSummaryCreateInput,
    createdAt: string
): BodyMeasurementSummaryCreateRow {
    return {
        client_id: input.clientId,
        created_at: createdAt,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        data_hash: input.dataHash,
        summary_text: input.summaryText,
        summary_png: input.summaryPng,
    };
}
