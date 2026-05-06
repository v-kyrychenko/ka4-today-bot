import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {MAIN_MESSAGE_QUEUE_URL} from '../../../../app/config/env.js';
import {log} from '../../../../shared/logging';
import type {QueueRequestEnvelope, SqsFifoMessageMetadata} from './sqsFifoMessageMetadata.js';

const sqsClient = new SQSClient();

export async function sendTelegramQueueRequest(
    payload: QueueRequestEnvelope,
    metadata: SqsFifoMessageMetadata
): Promise<void> {
    const message = JSON.stringify(payload);
    log(`Sending to queue:${MAIN_MESSAGE_QUEUE_URL} payload:${message}`);

    const command = new SendMessageCommand({
        QueueUrl: MAIN_MESSAGE_QUEUE_URL,
        MessageBody: message,
        ...metadata,
    });

    await sqsClient.send(command);
}
