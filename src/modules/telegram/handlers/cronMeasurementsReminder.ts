import {withAppInitialization} from '../../../app/withAppInitialization.js';
import {log} from '../../../shared/logging';
import {minusDays, toIsoDate} from '../../../shared/utils/dateUtils.js';
import {MIN_DAYS_BETWEEN_MEASUREMENTS} from '../features/measurements/bodyMeasurementService.js';
import {
    bodyMeasurementRepository,
    type BodyMeasurementReminderCandidate,
} from '../features/measurements/repository/bodyMeasurementRepository.js';
import {MEASUREMENTS_ROUTE} from '../routes/constants.js';
import {
    buildScheduledJobFifoMessageMetadata,
    QueueRequestEnvelope,
} from '../features/sqs/sqsFifoMessageMetadata.js';
import {sendTelegramQueueRequest} from '../features/sqs/telegramQueueSender.js';

const MEASUREMENTS_REMINDER_JOB_NAME = 'measurements-reminder';

export const handler = withAppInitialization(async (): Promise<void> => {
    const cutoffDate = getCutoffDate();
    log('Measurements reminder cron started', {cutoffDate, minDaysBetweenMeasurements: MIN_DAYS_BETWEEN_MEASUREMENTS});

    try {
        const users = await bodyMeasurementRepository.findReminderCandidates(cutoffDate);
        log('Measurements reminder cron found users', {count: users.length});

        await Promise.all(users.map(sendReminder));
    } catch (error) {
        log('Measurements reminder cron failed', error);
        throw error;
    }

    log('Measurements reminder cron finished');
});

function getCutoffDate(date = new Date()): string {
    return toIsoDate(minusDays(date, MIN_DAYS_BETWEEN_MEASUREMENTS));
}

async function sendReminder(user: BodyMeasurementReminderCandidate): Promise<void> {
    log('Measurements reminder selected user', {
        chatId: user.chatId,
        clientId: user.clientId,
        latestMeasurementDate: user.latestMeasurementDate,
    });

    try {
        const payload = createRequest(user);
        await sendTelegramQueueRequest(
            payload,
            buildScheduledJobFifoMessageMetadata(payload, MEASUREMENTS_REMINDER_JOB_NAME),
        );
        log('Measurements reminder queued user', {chatId: user.chatId, clientId: user.clientId});
    } catch (error) {
        log('Measurements reminder failed for user', {chatId: user.chatId, clientId: user.clientId, error});
        throw error;
    }
}

function createRequest(user: BodyMeasurementReminderCandidate): QueueRequestEnvelope {
    return new QueueRequestEnvelope({
        request: {
            message: {
                text: MEASUREMENTS_ROUTE,
                chat: {
                    id: user.chatId,
                },
            },
        },
    });
}
