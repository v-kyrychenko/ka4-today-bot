import {HttpApiError} from '../../../shared/errors';
import {parseIsoDate} from '../../../shared/utils/dateUtils.js';
import {
    type BodyMeasurementCreateInput,
} from '../commands/progress/bodyMeasurementsModel.js';
import {
    bodyMeasurementRepository,
} from '../commands/progress/repository/bodyMeasurementRepository.js';

const MIN_DAYS_BETWEEN_MEASUREMENTS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

export const bodyMeasurementService = {
    store,
};

export async function store(input: BodyMeasurementCreateInput[]): Promise<void> {
    const [firstMeasurement] = input;
    if (!firstMeasurement) {
        return;
    }

    const previous = await bodyMeasurementRepository.findLatestForClientOnOrBefore(
        firstMeasurement.clientId,
        firstMeasurement.createdAt,
    );
    if (previous && daysBetween(previous.createdAt, firstMeasurement.createdAt) < MIN_DAYS_BETWEEN_MEASUREMENTS) {
        throw new HttpApiError(
            409,
            'BODY_MEASUREMENT_TOO_SOON',
            'Body measurements can be submitted once every 30 days'
        );
    }

    await bodyMeasurementRepository.createMany(input);
}

function daysBetween(startDate: string, endDate: string): number {
    return (parseIsoDate(endDate).getTime() - parseIsoDate(startDate).getTime()) / MS_IN_DAY;
}
