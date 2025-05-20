import {log, logError} from '../utils/logger.js';

export async function httpRequest({
                                      method = 'GET',
                                      path,
                                      endpointUrl = '',
                                      headers = {},
                                      body = null,
                                      label = 'HTTP',
                                      errorClass = Error,
                                      hideResponse = true,
                                  }) {
    const fullUrl = endpointUrl ? `${endpointUrl}${path}` : path;
    const {requestInit, printableBody} = buildRequest(method, headers, body);

    log(`### ${label}:start: ${method} request to url = ${fullUrl}, body = ${printableBody}`);
    const start = Date.now();

    try {
        return await handleFetch({
            fullUrl,
            requestInit,
            method,
            label,
            hideResponse,
            errorClass,
            start,
            path: path, // for error logging
        });
    } catch (error) {
        // ⬇️ If this is already our custom, semantic API-level error, don't double-log
        if (error instanceof errorClass) {
            throw error; // already logged at the API level
        }
        const duration = Date.now() - start;
        const errorMsg = error.message.replace(/\\s+/g, ' ').trim();
        logError(`### ${label}:stop:  low-level error: ${method} response from url = ${fullUrl},
         status = n/a, time = ${duration} ms, response = ${errorMsg}`);
        throw new errorClass(`Failed ${label} request to ${path}: ${errorMsg}`);
    }
}

async function handleFetch({
                               fullUrl,
                               requestInit,
                               method,
                               label,
                               hideResponse,
                               errorClass,
                               start,
                               path
                           }) {
    const response = await fetch(fullUrl, requestInit);
    const duration = Date.now() - start;

    const responseBody = await response.json();
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

function truncate(text, maxLength = 1000) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
}

export function buildRequest(method, headers = {}, body = null) {
    let normalizedBody = null;

    if (method !== 'GET' && body) {
        normalizedBody = body
            ? typeof body === 'string'
                ? body
                : JSON.stringify(body)
            : null;
    }

    const requestInit = {
        method,
        headers,
        ...(normalizedBody && {body: normalizedBody}),
    };

    return {requestInit, printableBody: normalizedBody ?? 'null'};
}

