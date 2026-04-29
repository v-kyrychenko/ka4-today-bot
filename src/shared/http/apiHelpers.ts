import {BadRequestError} from '../errors';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../types/aws.js';
import {parseIsoDate, toIsoDate} from '../utils/dateUtils.js';

const ISO_DATE_LENGTH = 10;

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

export function assertAllowedKeys(body: Record<string, unknown>, allowedKeys: string[]): void {
    const unsupportedKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));

    if (unsupportedKeys.length > 0) {
        throw new BadRequestError(`Unsupported fields: ${unsupportedKeys.join(', ')}`);
    }
}

export function parseRequiredString(body: Record<string, unknown>, name: string, maxLength: number): string {
    const value = body[name];

    if (typeof value !== 'string') {
        throw new BadRequestError(`Field '${name}' must be a string`);
    }

    const normalized = value.trim();
    if (!normalized) {
        throw new BadRequestError(`Field '${name}' is required`);
    }
    if (normalized.length > maxLength) {
        throw new BadRequestError(`Field '${name}' must be at most ${maxLength} characters`);
    }

    return normalized;
}

export function parseRequiredDate(body: Record<string, unknown>, name: string): string {
    const value = parseRequiredString(body, name, ISO_DATE_LENGTH);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || toIsoDate(parseIsoDate(value)) !== value) {
        throw new BadRequestError(`Field '${name}' must be a valid date in YYYY-MM-DD format`);
    }

    return value;
}

export function parseOptionalNullableString(
    body: Record<string, unknown>,
    name: string
): string | null | undefined {
    if (!(name in body)) {
        return undefined;
    }

    const value = body[name];
    if (value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new BadRequestError(`Field '${name}' must be a string or null`);
    }

    return value;
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
