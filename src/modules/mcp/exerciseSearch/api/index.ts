import {withAppInitialization} from '../../../../app/withAppInitialization.js';
import {McpToolName} from '../../../../app/config/constants.js';
import {BadRequestError} from '../../../../shared/errors';
import {log, logError} from '../../../../shared/logging';
import {handleSearchExercises} from '../handlers/searchExercises.js';

interface AgentCoreLambdaContext {
    awsRequestId?: string;
    functionName?: string;
    clientContext?: {
        custom?: Record<string, string | undefined>;
    };
}

const initializedHandler = withAppInitialization(executeInvocation);

export async function handler(event: unknown, context: AgentCoreLambdaContext) {
    const startedAt = Date.now();
    const invocation = createInvocationLogContext(context);

    log('[mcp.invoke] Invocation started', invocation);

    try {
        const result = await initializedHandler(event, context);
        log('[mcp.invoke] Invocation completed', {...invocation, durationMs: Date.now() - startedAt, result});
        return result;
    } catch (error) {
        logError('[mcp.invoke] Invocation failed', {...invocation, durationMs: Date.now() - startedAt, error});
        throw error;
    }
}

async function executeInvocation(event: unknown, context: AgentCoreLambdaContext) {
    const rawToolName = extractToolName(context);
    const toolName = rawToolName as McpToolName | undefined;
    if (toolName && toolName !== McpToolName.SearchExercises) {
        throw new BadRequestError(`Unsupported MCP tool: ${rawToolName}`);
    }

    return handleSearchExercises(event);
}

function createInvocationLogContext(context: AgentCoreLambdaContext) {
    return {
        requestId: context.awsRequestId,
        functionName: context.functionName,
        toolName: extractToolName(context) ?? McpToolName.SearchExercises,
    };
}

function extractToolName(context: AgentCoreLambdaContext): string | undefined {
    return context.clientContext?.custom?.bedrockAgentCoreToolName?.split('___').pop();
}
