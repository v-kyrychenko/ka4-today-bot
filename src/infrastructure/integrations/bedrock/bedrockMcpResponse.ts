import {McpConnectionError, McpToolError} from '../../../shared/errors';
import type {BedrockResponse, BedrockResponseOutputItem} from './bedrockResponsesClient.js';

export function extractMcpToolOutput(response: BedrockResponse, toolName: string): unknown {
    const output = response.output ?? [];
    assertMcpConnection(output);

    const calls = output.filter((item) => item.type === 'mcp_call' && toolNameMatches(item.name, toolName));
    if (calls.length !== 1) {
        throw new McpToolError(`Expected one ${toolName} call, received ${calls.length}`);
    }

    const call = calls[0];
    if (call.error != null) {
        throw new McpToolError(`MCP tool failed: ${JSON.stringify(call.error)}`);
    }

    return unwrapToolResult(call.output);
}

function assertMcpConnection(output: BedrockResponseOutputItem[]): void {
    const listResult = output.find((item) => item.type === 'mcp_list_tools');
    if (!listResult || listResult.error != null) {
        throw new McpConnectionError(`AgentCore MCP tool discovery failed: ${JSON.stringify(listResult?.error)}`);
    }
}

function unwrapToolResult(value: unknown): unknown {
    let current = parseJsonValue(value);
    for (let depth = 0; depth < 3; depth += 1) {
        if (!isRecord(current)) return current;
        if (current.isError === true || current.error != null) {
            throw new McpToolError(`MCP tool returned an error: ${JSON.stringify(current.error ?? current)}`);
        }
        if ('result' in current) {
            current = parseJsonValue(current.result);
            continue;
        }
        if (Array.isArray(current.content)) {
            const text = toUnknownArray(current.content).find(
                (item) => isRecord(item) && typeof item.text === 'string',
            );
            current = isRecord(text) ? parseJsonValue(text.text) : current;
            continue;
        }
        return current;
    }
    return current;
}

function parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new McpToolError('MCP tool output is not valid JSON');
    }
}

function toolNameMatches(value: unknown, toolName: string): boolean {
    return typeof value === 'string' && (value === toolName || value.endsWith(`___${toolName}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value as unknown[] : [];
}
