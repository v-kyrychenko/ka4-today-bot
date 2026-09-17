import {
    ApiRequestFailureLevel,
    type ApiRequestLog,
    type ApiRequestLogMethod,
    startApiRequestLog,
} from './apiRequestLogger.js';

type ErrorWithStatus = Error & {status?: number; statusCode?: number};
type ErrorClassConstructor = new (message?: string, statusCode?: number) => ErrorWithStatus;

export interface HttpRequestParams<TBody = unknown> {
    method?: ApiRequestLogMethod;
    path: string;
    endpointUrl?: string;
    logUrl?: string;
    headers?: Record<string, string>;
    body?: TBody | null;
    label?: string;
    errorClass?: ErrorClassConstructor;
    showResponse?: boolean;
}

interface HandleFetchParams {
    fullUrl: string;
    requestInit: RequestInit;
    errorClass: ErrorClassConstructor;
    errorTarget: string;
    label: string;
    requestLog: ApiRequestLog;
}

export async function httpRequest<TResponse, TBody = unknown>({
    method = 'GET',
    path,
    endpointUrl = '',
    logUrl,
    headers = {},
    body = null,
    label = 'HTTP',
    errorClass = Error,
    showResponse = true,
}: HttpRequestParams<TBody>): Promise<TResponse> {
    const fullUrl = endpointUrl ? `${endpointUrl}${path}` : path;
    const safeLogUrl = logUrl ?? fullUrl;
    const errorTarget = logUrl ?? path;
    const {requestInit, printableBody} = buildRequest(method, headers, body);
    const requestLog = startApiRequestLog({
        label,
        method,
        url: safeLogUrl,
        body: printableBody,
        showResponse,
    });

    try {
        return await handleFetch<TResponse>({
            fullUrl,
            requestInit,
            errorClass,
            errorTarget,
            label,
            requestLog,
        });
    } catch (error) {
        if (error instanceof errorClass) {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const normalized = errorMessage.replace(/\s+/g, ' ').trim();
        requestLog.failure({level: ApiRequestFailureLevel.LowLevel, response: normalized});
        throw new errorClass(`Failed ${label} request to ${errorTarget}: ${normalized}`);
    }
}

async function handleFetch<TResponse>({
    fullUrl,
    requestInit,
    errorClass,
    errorTarget,
    label,
    requestLog,
}: HandleFetchParams): Promise<TResponse> {
    const response = await fetch(fullUrl, requestInit);

    const responseBody = (await response.json()) as TResponse;
    const rawText = JSON.stringify(responseBody).replace(/\s+/g, ' ');

    if (!response.ok) {
        requestLog.failure({level: ApiRequestFailureLevel.Api, status: response.status, response: rawText});
        const err = new errorClass(`Failed ${label} request to ${errorTarget}: ${rawText}`);
        err.status = response.status;
        throw err;
    }

    requestLog.success({status: response.status, response: rawText});
    return responseBody;
}

export function buildRequest<TBody = unknown>(
    method: ApiRequestLogMethod,
    headers: Record<string, string> = {},
    body: TBody | null = null,
): {requestInit: RequestInit; printableBody: string} {
    const isFormData = body instanceof FormData;
    let requestBody: BodyInit | null = null;
    let printableBody = 'null';

    if (method !== 'GET' && body) {
        if (isFormData) {
            requestBody = body;
            printableBody = '#form-data';
        } else if (typeof body === 'string') {
            requestBody = body;
            printableBody = body;
        } else {
            requestBody = JSON.stringify(body);
            printableBody = requestBody;
        }
    }

    const requestInit: RequestInit = {
        method,
        headers,
        ...(requestBody ? {body: requestBody} : {}),
    };

    return {requestInit, printableBody};
}
