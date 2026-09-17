import {Sha256} from '@aws-crypto/sha256-js';
import {defaultProvider} from '@aws-sdk/credential-provider-node';
import {HttpRequest} from '@smithy/protocol-http';
import {SignatureV4} from '@smithy/signature-v4';
import {AWS_REGION} from '../../../app/config/env.js';
import {BedrockResponsesError} from '../../../shared/errors';

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

    const endpoint = new URL(`https://bedrock-mantle.${AWS_REGION}.api.aws/v1/responses`);
    const serializedBody = JSON.stringify(body);
    const signer = new SignatureV4({
        credentials,
        region: AWS_REGION,
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

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: signed.method,
            headers: signed.headers,
            body: serializedBody,
        });
    } catch (error) {
        throw new BedrockResponsesError(`Bedrock Responses API request failed: ${toErrorMessage(error)}`);
    }

    const text = await response.text();
    if (!response.ok) {
        throw new BedrockResponsesError(`Bedrock Responses API returned ${response.status}: ${text}`);
    }

    try {
        return JSON.parse(text) as BedrockResponse;
    } catch {
        throw new BedrockResponsesError('Bedrock Responses API returned invalid JSON');
    }
}

function resolveSigningService(hostname: string): string {
    return hostname.startsWith('bedrock-runtime.') ? 'bedrock' : 'bedrock-mantle';
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
