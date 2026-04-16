import {log, logError} from '../logging';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ErrorWithStatus = Error & {status?: number; statusCode?: number};
type ErrorClassConstructor = new (message?: string, statusCode?: number) => ErrorWithStatus;

export interface HttpRequestParams<TBody = unknown> {
    method?: HttpMethod;
    path: string;
    endpointUrl?: string;
    headers?: Record<string, string>;
    body?: TBody | null;
    label?: string;
    errorClass?: ErrorClassConstructor;
    hideResponse?: boolean;
}

interface HandleFetchParams {
    fullUrl: string;
    requestInit: RequestInit;
    method: HttpMethod;
    label: string;
    hideResponse: boolean;
    errorClass: ErrorClassConstructor;
    start: number;
    path: string;
}

export async function httpRequest<TResponse, TBody = unknown>({
    method = 'GET',
    path,
    endpointUrl = '',
    headers = {},
    body = null,
    label = 'HTTP',
    errorClass = Error as unknown as ErrorClassConstructor,
    hideResponse = true,
}: HttpRequestParams<TBody>): Promise<TResponse> {
    const fullUrl = endpointUrl ? `${endpointUrl}${path}` : path;
    const {requestInit, printableBody} = buildRequest(method, headers, body);

    log(`### ${label}:start: ${method} request to url = ${fullUrl}, body = ${printableBody}`);
    const start = Date.now();

    try {
        return await handleFetch<TResponse>({
            fullUrl,
            requestInit,
            method,
            label,
            hideResponse,
            errorClass,
            start,
            path,
        });
    } catch (error) {
        if (error instanceof errorClass) {
            throw error;
        }

        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const normalized = errorMessage.replace(/\s+/g, ' ').trim();
        logError(`### ${label}:stop: low-level error: ${method} response from url = ${fullUrl},
         status = n/a, time = ${duration} ms, response = ${normalized}`);
        throw new errorClass(`Failed ${label} request to ${path}: ${normalized}`);
    }
}

async function handleFetch<TResponse>({
    fullUrl,
    requestInit,
    method,
    label,
    hideResponse,
    errorClass,
    start,
    path,
}: HandleFetchParams): Promise<TResponse> {
    const response = await fetch(fullUrl, requestInit);
    const duration = Date.now() - start;

    const responseBody = (await response.json()) as TResponse;
    const rawText = JSON.stringify(responseBody).replace(/\s+/g, ' ');
    const logResponse = hideResponse ? '#hidden' : truncate(rawText);

    if (!response.ok) {
        logError(`### ${label}:stop: api-level error: ${method} response from url = ${fullUrl},
        status = ${response.status}, time = ${duration} ms, response = ${rawText}`);
        const err = new errorClass(`Failed ${label} request to ${path}: ${rawText}`);
        err.status = response.status;
        throw err;
    }

    log(`### ${label}:stop: ${method} response from url = ${fullUrl},
    status = ${response.status}, time = ${duration} ms, response = ${logResponse}`);
    return responseBody;
}

function truncate(text: string, maxLength = 1000): string {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
}

export function buildRequest<TBody = unknown>(
    method: HttpMethod,
    headers: Record<string, string> = {},
    body: TBody | null = null
): {requestInit: RequestInit; printableBody: string} {
    const normalizedBody =
        method !== 'GET' && body
            ? typeof body === 'string'
                ? body
                : JSON.stringify(body)
            : null;

    const requestInit: RequestInit = {
        method,
        headers,
        ...(normalizedBody ? {body: normalizedBody} : {}),
    };

    return {requestInit, printableBody: normalizedBody ?? 'null'};
}
