import type {ApiGatewayHttpEvent} from '../types/aws.js';
import {BadRequestError} from '../errors';

export function parseJsonBody<T>(event: ApiGatewayHttpEvent): T {
    if (!event.body) {
        throw new BadRequestError('Request body is required');
    }

    try {
        return JSON.parse(event.body) as T;
    } catch {
        throw new BadRequestError('Request body must be valid JSON');
    }
}
