import {Sha256} from '@aws-crypto/sha256-js';
import {defaultProvider} from '@aws-sdk/credential-provider-node';
import {HttpRequest} from '@smithy/protocol-http';
import {SignatureV4} from '@smithy/signature-v4';
import {AWS_REGION} from '../../../app/config/env.js';
import {BedrockResponsesError} from '../../../shared/errors';
import {ApiRequestFailureLevel, startApiRequestLog} from '../../../shared/http/apiRequestLogger.js';
import {
    BEDROCK_RESPONSES_API_LABEL,
    BEDROCK_RESPONSES_ENDPOINT,
    BEDROCK_RESPONSES_TIMEOUT_MS,
} from './constants.js';

export interface BedrockResponseOutputItem {
    type?: unknown;
    role?: unknown;
    name?: unknown;
    output?: unknown;
    error?: unknown;
    tools?: unknown;
    content?: unknown;
}

export interface BedrockResponse {
    id?: unknown;
    status?: unknown;
    error?: unknown;
    output?: BedrockResponseOutputItem[];
}

export const bedrockResponsesClient = {
    createResponse,
};

const credentials = defaultProvider();

export async function createResponse(body: Record<string, unknown>): Promise<BedrockResponse> {
    if (!AWS_REGION) {
        throw new BedrockResponsesError('AWS_REGION is required for the Bedrock Responses API');
    }

    const serializedBody = JSON.stringify(body);
    const requestLog = startApiRequestLog({
        label: BEDROCK_RESPONSES_API_LABEL,
        method: 'POST',
        url: BEDROCK_RESPONSES_ENDPOINT.toString(),
        body: JSON.stringify(summarizeRequest(body, BEDROCK_RESPONSES_ENDPOINT, serializedBody.length)),
    });

    let response: Response | undefined;
    try {
        response = await sendRequest(BEDROCK_RESPONSES_ENDPOINT, serializedBody, AWS_REGION);
        const text = await response.text();
        if (!response.ok) {
            throw new BedrockResponsesError(`Bedrock Responses API returned ${response.status}: ${text}`);
        }

        const result = parseResponse(text);
        const responseLog = {
            ...summarizeHttpResponse(response),
            ...summarizeResponse(result),
        };
        if (result.error) {
            requestLog.failure({
                level: ApiRequestFailureLevel.Api,
                status: response.status,
                response: JSON.stringify(responseLog),
            });
        } else {
            requestLog.success({status: response.status, response: JSON.stringify(responseLog)});
        }
        return result;
    } catch (error) {
        const bedrockError = toBedrockError(error);
        requestLog.failure({
            level: response ? ApiRequestFailureLevel.Api : ApiRequestFailureLevel.LowLevel,
            ...(response ? {status: response.status} : {}),
            response: bedrockError.message,
        });
        throw bedrockError;
    }
}

async function sendRequest(endpoint: URL, serializedBody: string, region: string): Promise<Response> {
    const signer = new SignatureV4({
        credentials,
        region,
        service: resolveSigningService(endpoint.hostname),
        sha256: Sha256,
    });
    const signed = await signer.sign(new HttpRequest({
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port ? Number(endpoint.port) : undefined,
        method: 'POST',
        path: `${endpoint.pathname}${endpoint.search}`,
        headers: {
            host: endpoint.host,
            'content-type': 'application/json',
        },
        body: serializedBody,
    }));

    return fetch(endpoint, {
        method: signed.method,
        headers: signed.headers,
        body: serializedBody,
        signal: AbortSignal.timeout(BEDROCK_RESPONSES_TIMEOUT_MS),
    });
}

function parseResponse(text: string): BedrockResponse {
    try {
        return JSON.parse(text) as BedrockResponse;
    } catch {
        throw new BedrockResponsesError('Bedrock Responses API returned invalid JSON');
    }
}

function summarizeRequest(body: Record<string, unknown>, endpoint: URL, bodyBytes: number) {
    const reasoning = toRecord(body.reasoning);
    const text = toRecord(body.text);
    const format = toRecord(text?.format);

    return {
        region: AWS_REGION,
        endpoint: endpoint.pathname,
        model: body.model,
        background: body.background,
        store: body.store,
        reasoningEffort: reasoning?.effort,
        toolChoice: body.tool_choice,
        inputRoles: summarizeInputRoles(body.input),
        responseFormat: format?.type,
        responseSchemaName: format?.name,
        strictResponseSchema: format?.strict,
        tools: summarizeTools(body.tools),
        bodyBytes,
        timeoutMs: BEDROCK_RESPONSES_TIMEOUT_MS,
    };
}

function summarizeHttpResponse(response: Response) {
    return {
        httpStatus: response.status,
        awsRequestId: response.headers.get('x-amzn-requestid') ?? response.headers.get('x-amzn-request-id'),
    };
}

function summarizeResponse(response: BedrockResponse) {
    const error = toRecord(response.error);
    return {
        responseId: response.id,
        responseStatus: response.status,
        outputTypes: response.output?.map((item) => item.type),
        errorCode: error?.code,
        errorMessage: error?.message,
    };
}

function summarizeInputRoles(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => toRecord(item)?.role).filter((role) => role !== undefined);
}

function summarizeTools(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
        const tool = toRecord(item);
        return {
            type: tool?.type,
            serverLabel: tool?.server_label,
            requireApproval: tool?.require_approval,
        };
    });
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ?
        value as Record<string, unknown> : undefined;
}

function resolveSigningService(hostname: string): string {
    return hostname.startsWith('bedrock-runtime.') ? 'bedrock' : 'bedrock-mantle';
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function toBedrockError(error: unknown): BedrockResponsesError {
    if (error instanceof BedrockResponsesError) return error;
    if (error instanceof Error && error.name === 'TimeoutError') {
        return new BedrockResponsesError(`Bedrock Responses API timed out after ${BEDROCK_RESPONSES_TIMEOUT_MS} ms`);
    }
    return new BedrockResponsesError(`Bedrock Responses API request failed: ${toErrorMessage(error)}`);
}
