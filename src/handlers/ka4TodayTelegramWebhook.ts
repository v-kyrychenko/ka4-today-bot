import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {TELEGRAM_SECURITY_TOKEN, MAIN_MESSAGE_QUEUE_URL} from '../config/env.js';
import {logError} from '../utils/logger.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../models/aws.js';
import {QueueRequestEnvelope} from '../models/app.js';
import {TelegramWebhookRequest} from '../models/telegram.js';

const sqsClient = new SQSClient();

export const handler = async (event: ApiGatewayHttpEvent): Promise<LambdaResponse> => {
    if (!isAuthorized(event.headers)) {
        return buildResponse(401, 'Unauthorized');
    }

    try {
        const request = new TelegramWebhookRequest(parseJsonBody<TelegramWebhookRequest>(event.body));
        await sendToQueue(new QueueRequestEnvelope({request}));

        return {
            statusCode: 200,
            body: JSON.stringify({ok: true}),
        };
    } catch (error) {
        logError('Failed to process webhook', error);
        return buildResponse(500, 'Internal Server Error');
    }
};

function isAuthorized(headers: Record<string, string | undefined> = {}): boolean {
    const token =
        headers['x-telegram-bot-api-secret-token'] ??
        headers['X-Telegram-Bot-Api-Secret-Token'];
    return token === TELEGRAM_SECURITY_TOKEN;
}

function buildResponse(statusCode: number, message: string): LambdaResponse {
    return {
        statusCode,
        body: JSON.stringify({message}),
    };
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
    });

    await sqsClient.send(command);
}
