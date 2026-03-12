import {mainProcessor} from '../services/mainProcessor.js';
import {logError} from '../utils/logger.js';
import type {LambdaResponse, SqsEvent} from '../models/aws.js';
import {TelegramWebhookRequest} from '../models/telegram.js';

export const handler = async (event: SqsEvent): Promise<LambdaResponse | undefined> => {
    for (const record of event.Records) {
        try {
            const payload = JSON.parse(record.body) as {request?: unknown};
            const body = extractBody(payload.request);
            await mainProcessor.execute(body);
            return buildResponse(200, 'OK');
        } catch (error) {
            logError('webhook execution failed', error);
            const err = error as Error & {statusCode?: number};
            const status = err.statusCode ?? 500;
            const message = err.message || 'Internal Server Error';
            return buildResponse(status, message);
        }
    }

    return undefined;
};

export function extractBody(input: unknown): TelegramWebhookRequest {
    if (!input) {
        throw new Error('Missing request body');
    }

    if (typeof input === 'object') {
        return new TelegramWebhookRequest(input as Partial<TelegramWebhookRequest>);
    }

    if (typeof input === 'string') {
        try {
            return new TelegramWebhookRequest(JSON.parse(input) as Partial<TelegramWebhookRequest>);
        } catch {
            throw new Error('Invalid JSON in body string');
        }
    }

    throw new Error('Unsupported body format');
}

function buildResponse(statusCode: number, message: string): LambdaResponse {
    return {
        statusCode,
        body: JSON.stringify({message}),
    };
}
