import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {MAIN_MESSAGE_QUEUE_URL} from '../../../app/config/env.js';
import {dynamoDbService} from '../../../infrastructure/persistence/dynamodb/legacy/dynamoDbService.js';
import {log} from '../../../shared/logging/index.js';
import {TrainingScheduleItem} from '../../../shared/types/app.js';
import {QueueRequestEnvelope} from '../domain/context.js';

const sqsClient = new SQSClient();

export const handler = async (): Promise<void> => {
    log('Daily cron started');

    try {
        const scheduledUsers = await dynamoDbService.getUsersScheduledForDay();

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

function createRequest(item: TrainingScheduleItem): QueueRequestEnvelope {
    return new QueueRequestEnvelope({
        request: {
            message: {
                promptRef: item.prompt_ref,
                text: '/daily_greeting',
                chat: {
                    id: item.chat_id,
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
