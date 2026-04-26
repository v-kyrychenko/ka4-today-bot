import type {BodyMeasurementType} from './bodyMeasurementType.js';

export interface BodyMeasurement {
    id: number;
    clientId: number;
    createdAt: string;
    amount: number;
    type: BodyMeasurementType;
    unitKey: string;
}

