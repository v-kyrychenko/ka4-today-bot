import {withAppInitialization} from '../../../app/withAppInitialization.js';
import {log} from '../../../shared/logging';
import {
    buildScheduledJobFifoMessageMetadata,
    QueueRequestEnvelope,
} from '../features/sqs/sqsFifoMessageMetadata.js';
import {DAILY_GREETING_ROUTE} from '../routes/constants.js';
import {WorkoutSchedule} from '../features/workouts/workout.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import {sendTelegramQueueRequest} from '../features/sqs/telegramQueueSender.js';

const DAILY_MESSAGE_JOB_NAME = 'daily-message';

export const handler = withAppInitialization(async (): Promise<void> => {
    log('Daily cron started');

    try {
        const scheduledUsers = await tgUserRepository.getUsersScheduledForDay();
        log('Daily cron found scheduled users', scheduledUsers.map((item) => item.client.chatId));

        await Promise.all(
            scheduledUsers.map(async (item) => {
                const payload = createRequest(item);
                await sendTelegramQueueRequest(
                    payload,
                    buildScheduledJobFifoMessageMetadata(payload, getDailyMessageJobName(payload)),
                );
            })
        );
    } catch (error) {
        log('Daily cron failed', error);
        throw error;
    }

    log('Daily cron finished');
});

function createRequest(item: WorkoutSchedule): QueueRequestEnvelope {
    return new QueueRequestEnvelope({
        request: {
            message: {
                promptRef: item.dictPrompt.key,
                text: DAILY_GREETING_ROUTE,
                chat: {
                    id: item.client.chatId,
                },
            },
        },
    });
}

function getDailyMessageJobName(payload: QueueRequestEnvelope): string {
    const promptRef = payload.request.message?.promptRef?.trim();
    if (!promptRef) {
        return '';
    }

    return `${DAILY_MESSAGE_JOB_NAME}-${promptRef}`;
}
