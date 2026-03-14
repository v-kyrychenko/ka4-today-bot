import type {LambdaResponse} from '../../models/aws.js';
import {jsonResponse} from '../api.js';

type ErrorWithStatusCode = Error & {
    statusCode?: number;
};

export function toErrorResponse(error: unknown): LambdaResponse {
    const err = error instanceof Error ? error as ErrorWithStatusCode : undefined;
    const statusCode = err?.statusCode ?? 500;
    const message = err?.message || 'Internal Server Error';

    return jsonResponse(statusCode, {message});
}
