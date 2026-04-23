import {withAppInitialization} from '../../../app/withAppInitialization.js';
import {log, logError} from '../../../shared/logging';
import type {LambdaResponse, SqsEvent} from '../../../shared/types/aws.js';
import {mainProcessor} from '../application/mainProcessor.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';

export const handler = withAppInitialization(async (event: SqsEvent): Promise<LambdaResponse | undefined> => {
    log('[telegram.async] Processing SQS batch', {
        recordCount: event.Records.length,
    });

    for (const [recordIndex, record] of event.Records.entries()) {
        try {
            log('[telegram.async] Processing SQS record', {
                recordIndex,
            });
            const payload = JSON.parse(record.body) as {request?: unknown};
            const body = extractBody(payload.request);
            log('[telegram.async] Executing main processor', {
                recordIndex,
            });
            await mainProcessor.execute(body);
            log('[telegram.async] Record processed successfully', {
                recordIndex,
            });
            return buildResponse(200, 'OK');
        } catch (error) {
            logError('[telegram.async] Record processing failed', {
                recordIndex,
                error,
            });
            const err = error as Error & {statusCode?: number};
            const status = err.statusCode ?? 500;
            const message = err.message || 'Internal Server Error';
            return buildResponse(status, message);
        }
    }

    return undefined;
});

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
