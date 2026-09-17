import {log, logError} from '../logging';

export type ApiRequestLogMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export enum ApiRequestFailureLevel {
    Api = 'api-level error',
    LowLevel = 'low-level error',
}

interface ApiRequestLogInput {
    label: string;
    method: ApiRequestLogMethod;
    url: string;
    body: string;
    showResponse?: boolean;
}

interface ApiRequestSuccessInput {
    status: number;
    response: string;
}

interface ApiRequestFailureInput {
    level: ApiRequestFailureLevel;
    status?: number;
    response: string;
}

export interface ApiRequestLog {
    success(input: ApiRequestSuccessInput): void;
    failure(input: ApiRequestFailureInput): void;
}

export function startApiRequestLog(input: ApiRequestLogInput): ApiRequestLog {
    const startedAt = Date.now();
    const showResponse = input.showResponse ?? true;
    log(`### ${input.label}:start: ${input.method} request to url = ${input.url}, body = ${input.body}`);

    return {
        success: (response) => log(createStopMessage(
            input,
            startedAt,
            response.status,
            formatResponse(response.response, showResponse),
        )),
        failure: (response) => logError(createStopMessage(
            input,
            startedAt,
            response.status ?? 'n/a',
            formatResponse(response.response, showResponse),
            response.level,
        )),
    };
}

function createStopMessage(
    input: ApiRequestLogInput,
    startedAt: number,
    status: number | string,
    response: string,
    failureLevel?: ApiRequestFailureLevel,
): string {
    const result = failureLevel ? `${failureLevel}: ` : '';
    return `### ${input.label}:stop: ${result}${input.method} response from url = ${input.url}, ` +
        `status = ${status}, time = ${Date.now() - startedAt} ms, response = ${normalizeLogText(response)}`;
}

function normalizeLogText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function formatResponse(response: string, showResponse: boolean, maxLength = 1000): string {
    if (!showResponse) return '#hidden';
    const normalized = normalizeLogText(response);
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...[truncated]` : normalized;
}
