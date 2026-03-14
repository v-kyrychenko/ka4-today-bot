import type {ApiGatewayHttpEvent} from '../../models/aws.js';
import {BadRequestError} from '../errors.js';

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
