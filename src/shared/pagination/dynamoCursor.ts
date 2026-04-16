import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {BadRequestError} from '../errors/index.js';

export function parseDynamoCursor(cursor?: string): Record<string, AttributeValue> | undefined {
    if (!cursor) {
        return undefined;
    }

    try {
        return JSON.parse(decodeURIComponent(cursor)) as Record<string, AttributeValue>;
    } catch {
        throw new BadRequestError("Query param 'cursor' must be a valid pagination token");
    }
}

export function encodeDynamoCursor(cursor: Record<string, AttributeValue>): string {
    return encodeURIComponent(JSON.stringify(cursor));
}
