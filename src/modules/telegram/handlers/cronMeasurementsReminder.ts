import {withAppInitialization} from '../../../app/withAppInitialization.js';
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {MAIN_MESSAGE_QUEUE_URL} from '../../../app/config/env.js';
import {log} from '../../../shared/logging';
import {minusDays, toIsoDate} from '../../../shared/utils/dateUtils.js';
import {MIN_DAYS_BETWEEN_MEASUREMENTS} from '../features/measurements/bodyMeasurementService.js';
import {
    bodyMeasurementRepository,
    type BodyMeasurementReminderCandidate,
} from '../features/measurements/repository/bodyMeasurementRepository.js';
import {MEASUREMENTS_ROUTE} from '../routes/registry.js';
import {buildScheduledJobFifoMessageMetadata, QueueRequestEnvelope} from './sqsFifoMessageMetadata.js';

const MEASUREMENTS_REMINDER_JOB_NAME = 'measurements-reminder';
const sqsClient = new SQSClient();

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
        await sendToQueue(payload);
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

async function sendToQueue(payload: QueueRequestEnvelope): Promise<void> {
    const message = JSON.stringify(payload);
    log(`Sending to queue:${MAIN_MESSAGE_QUEUE_URL} payload:${message}`);
    const command = new SendMessageCommand({
        QueueUrl: MAIN_MESSAGE_QUEUE_URL,
        MessageBody: message,
        ...buildScheduledJobFifoMessageMetadata(payload, MEASUREMENTS_REMINDER_JOB_NAME),
    });

    await sqsClient.send(command);
}
