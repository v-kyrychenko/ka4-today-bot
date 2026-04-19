import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {MAIN_MESSAGE_QUEUE_URL} from '../../../app/config/env.js';
import {log} from '../../../shared/logging';
import {QueueRequestEnvelope} from '../domain/context.js';
import {WorkoutSchedule} from '../domain/workout.js';
import {telegramUserRepository} from '../repository/telegramUserRepository.js';
import {DAILY_GREETING_COMMAND} from "../commands/registry";

const sqsClient = new SQSClient();

export const handler = async (): Promise<void> => {
    log('Daily cron started');

    try {
        const scheduledUsers = await telegramUserRepository.getUsersScheduledForDay();

        await Promise.all(
            scheduledUsers.map(async (item) => {
                const payload = createRequest(item);
                await sendToQueue(payload);
            })
        );
    } catch (error) {
        log('Daily cron failed', error);
        throw error;
    }

    log('Daily cron finished');
};

function createRequest(item: WorkoutSchedule): QueueRequestEnvelope {
    return new QueueRequestEnvelope({
        request: {
            message: {
                promptRef: item.dictPrompt.key,
                text: DAILY_GREETING_COMMAND,
                chat: {
                    id: item.client.chatId,
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
    });

    await sqsClient.send(command);
}
