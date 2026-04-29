import type {LambdaResponse} from '../types/aws.js';
import {jsonResponse} from './apiHelpers.js';

type ErrorWithStatusCode = Error & {
    code?: string;
    statusCode?: number;
};

export function toErrorResponse(error: unknown): LambdaResponse {
    const err = error instanceof Error ? error as ErrorWithStatusCode : undefined;
    const statusCode = err?.statusCode ?? 500;
    const message = err?.message || 'Internal Server Error';

    return jsonResponse(statusCode, {
        message,
        ...(err?.code ? {code: err.code} : {}),
    });
}
