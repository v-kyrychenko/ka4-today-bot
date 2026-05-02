import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {MAIN_MESSAGE_QUEUE_URL, TELEGRAM_SECURITY_TOKEN} from '../../../app/config/env.js';
import {toShortErrorLog} from '../../../shared/errors';
import {logError} from '../../../shared/logging';
import {
    buildResponse,
    buildSuccessResponse,
    type ApiGatewayHttpEvent,
    type LambdaResponse,
} from '../../../shared/types/aws.js';
import {buildWebhookFifoMessageMetadata} from '../application/sqsFifoMessageMetadata.js';
import {QueueRequestEnvelope} from '../domain/context.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';

const sqsClient = new SQSClient();

export const handler = async (event: ApiGatewayHttpEvent): Promise<LambdaResponse> => {
    if (!isAuthorized(event.headers)) {
        return buildResponse(401, 'Unauthorized');
    }

    try {
        const request = new TelegramWebhookRequest(parseJsonBody<TelegramWebhookRequest>(event.body));
        await sendToQueue(new QueueRequestEnvelope({request}));

        return buildSuccessResponse();
    } catch (error) {
        logError('[telegram.webhook] Failed to process webhook', toShortErrorLog(error));
        return buildSuccessResponse();
    }
};

function isAuthorized(headers: Record<string, string | undefined> = {}): boolean {
    const token =
        headers['x-telegram-bot-api-secret-token'] ??
        headers['X-Telegram-Bot-Api-Secret-Token'];
    return token === TELEGRAM_SECURITY_TOKEN;
}

function parseJsonBody<T>(body?: string | null): T {
    if (!body) {
        throw new Error('Missing request body');
    }
    return JSON.parse(body) as T;
}

async function sendToQueue(payload: QueueRequestEnvelope): Promise<void> {
    const command = new SendMessageCommand({
        QueueUrl: MAIN_MESSAGE_QUEUE_URL,
        MessageBody: JSON.stringify(payload),
        ...buildWebhookFifoMessageMetadata(payload),
    });

    await sqsClient.send(command);
}
