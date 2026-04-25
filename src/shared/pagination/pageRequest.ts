import type {ApiGatewayHttpEvent} from '../types/aws.js';
import {getQueryParam, parseOptionalInteger} from '../http/apiHelpers.js';

export type PageRequest<TCursor> = {
    limit: number;
    cursor?: TCursor;
};

export function parsePageRequest<TCursor>(
    event: ApiGatewayHttpEvent,
    options: {
        defaultLimit: number;
        maxLimit: number;
        parseCursor: (value?: string) => TCursor | undefined;
    },
): PageRequest<TCursor> {
    const limit = parseOptionalInteger(getQueryParam(event, 'limit'), {
        defaultValue: options.defaultLimit,
        min: 1,
        max: options.maxLimit,
        name: 'limit',
    });
    const cursor = options.parseCursor(getQueryParam(event, 'cursor'));

    return {
        limit,
        cursor,
    };
}
