export interface BodyMeasurementSummaryRow {
    id: number;
    client_id: number;
    created_at: string;
    period_start: string;
    period_end: string;
    data_hash: string;
    summary_text: string;
    summary_png: Buffer;
}

