import {BadRequestError} from '../errors/index.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../types/aws.js';

export function getHttpMethod(event: ApiGatewayHttpEvent): string {
    return event.requestContext?.http?.method ?? 'GET';
}

export function getPathParam(event: ApiGatewayHttpEvent, name: string): string {
    const value = event.pathParameters?.[name];
    if (!value) {
        throw new BadRequestError(`Path param '${name}' is required`);
    }

    return value;
}

export function getQueryParam(event: ApiGatewayHttpEvent, name: string): string | undefined {
    return event.queryStringParameters?.[name];
}

export function parseOptionalInteger(value: string | undefined, options: {
    defaultValue: number;
    min: number;
    max: number;
    name: string;
}): number {
    if (!value) return options.defaultValue;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
        throw new BadRequestError(
            `Query param '${options.name}' must be an integer between ${options.min} and ${options.max}`
        );
    }

    return parsed;
}

export function jsonResponse(statusCode: number, body: unknown): LambdaResponse {
    return {
        statusCode,
        body: JSON.stringify(body),
    };
}
