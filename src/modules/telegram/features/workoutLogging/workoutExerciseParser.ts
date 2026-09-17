import {DEFAULT_BEDROCK_MODEL_ID, McpToolName} from '../../../../app/config/constants.js';
import {BEDROCK_AGENTCORE_GATEWAY_ARN} from '../../../../app/config/env.js';
import {
    bedrockResponsesClient,
    type BedrockResponse,
} from '../../../../infrastructure/integrations/bedrock/bedrockResponsesClient.js';
import {extractMcpToolOutput} from '../../../../infrastructure/integrations/bedrock/bedrockMcpResponse.js';
import {
    BedrockResponsesError,
    MalformedAiResponseError,
    McpToolError,
} from '../../../../shared/errors';
import type {ExerciseSearchCandidate} from '../../../mcp/exerciseSearch/domain/exerciseSearchCandidate.js';
import {promptTemplateService} from '../prompts/promptTemplateService.js';

export interface WorkoutExerciseParseResult {
    parsedExercise: ParsedWorkoutExercise;
    candidates: ExerciseSearchCandidate[];
}

export interface ParseExerciseMessageRequest {
    message: string;
    lang?: string | null;
}

export interface ParsedWorkoutExercise {
    name: string;
    reps: number;
    sets: number;
    weight: number | null;
}

interface StructuredWorkoutReply {
    exerciseName: string;
    reps: number | null;
    sets: number | null;
    weight: number | null;
    weightRequired: boolean;
    multipleExercises: boolean;
    candidates: ExerciseSearchCandidate[];
}

const WORKOUT_EXERCISE_PARSER_PROMPT_REF = 'workout_exercise_parser';
export async function parseExerciseMessage(
    request: ParseExerciseMessageRequest,
): Promise<WorkoutExerciseParseResult | null> {
    const template = await promptTemplateService.resolve({
        lang: request.lang,
        promptRef: WORKOUT_EXERCISE_PARSER_PROMPT_REF,
        variables: {USER_INPUT: request.message},
    });
    const bedrockRequest = buildRequest(template.systemPrompt, template.userPrompt);
    const response = await bedrockResponsesClient.createResponse(bedrockRequest);
    const reply = extractStructuredReply(response);
    const parsedExercise = toParsedExercise(reply);

    if (!parsedExercise) {
        return null;
    }

    const authoritativeCandidates = extractMcpCandidates(response);
    if (JSON.stringify(reply.candidates) !== JSON.stringify(authoritativeCandidates)) {
        throw new MalformedAiResponseError('Assistant candidate data does not match authoritative MCP output');
    }

    return {parsedExercise, candidates: authoritativeCandidates};
}

//TODO should be fetched and configured dynamiclaly from db Bedrock Prompt Management
function buildRequest(systemPrompt: string, userPrompt: string): Record<string, unknown> {
    if (!BEDROCK_AGENTCORE_GATEWAY_ARN) {
        throw new BedrockResponsesError('Bedrock workout parser configuration is incomplete');
    }

    return {
        model: DEFAULT_BEDROCK_MODEL_ID,
        store: false,
        background: false,
        reasoning: {effort: 'minimal'},
        input: [
            {
                role: 'system',
                content: `${systemPrompt}\n\nAfter parsing one valid exercise, call the ` +
                    `${McpToolName.SearchExercises} MCP tool ` +
                    'with the parsed exercise name as `query`. Return exactly the candidates produced by that tool. ' +
                    'Never alter, invent, reorder, or omit candidate fields. For invalid or multiple exercises, ' +
                    'return no candidates.',
            },
            {role: 'user', content: userPrompt},
        ],
        text: {
            format: {
                type: 'json_schema',
                name: 'workout_exercise_parse',
                strict: true,
                schema: WORKOUT_RESPONSE_SCHEMA,
            },
        },
        tools: [{
            type: 'mcp',
            server_label: 'exercise_search',
            connector_id: BEDROCK_AGENTCORE_GATEWAY_ARN, //TODO move to DB
            server_description: 'Searches the authoritative exercise catalog while preserving PostgreSQL ranking.',
            require_approval: 'never',
        }],
    };
}

const CANDIDATE_SCHEMA = {
    type: 'object',
    properties: {
        exerciseId: {type: 'integer'},
        id: {type: 'string'},
        name: {type: 'string'},
        score: {type: 'number'},
        imageKey: {anyOf: [{type: 'string'}, {type: 'null'}]},
    },
    required: ['exerciseId', 'id', 'name', 'score', 'imageKey'],
    additionalProperties: false,
};

const WORKOUT_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        exerciseName: {type: 'string'},
        reps: {anyOf: [{type: 'number'}, {type: 'null'}]},
        sets: {anyOf: [{type: 'number'}, {type: 'null'}]},
        weight: {anyOf: [{type: 'number'}, {type: 'null'}]},
        weightRequired: {type: 'boolean'},
        multipleExercises: {type: 'boolean'},
        candidates: {type: 'array', items: CANDIDATE_SCHEMA},
    },
    required: ['exerciseName', 'reps', 'sets', 'weight', 'weightRequired', 'multipleExercises', 'candidates'],
    additionalProperties: false,
};

function extractStructuredReply(response: BedrockResponse): StructuredWorkoutReply {
    if (response.status !== 'completed' || !Array.isArray(response.output)) {
        throw new BedrockResponsesError(`Bedrock response did not complete: ${JSON.stringify(response.error)}`);
    }

    for (const item of [...response.output].reverse()) {
        if (item.type !== 'message' || item.role !== 'assistant') continue;
        for (const part of toUnknownArray(item.content)) {
            if (isRecord(part) && part.type === 'output_text' && typeof part.text === 'string') {
                return parseStructuredReply(part.text);
            }
        }
    }

    throw new MalformedAiResponseError('Bedrock response has no final assistant JSON');
}

function parseStructuredReply(value: unknown): StructuredWorkoutReply {
    const parsed = parseJsonValue(value);
    if (!isRecord(parsed) || typeof parsed.exerciseName !== 'string' || !isNullableNumber(parsed.reps) ||
        !isNullableNumber(parsed.sets) || !isNullableNumber(parsed.weight) ||
        typeof parsed.weightRequired !== 'boolean' || typeof parsed.multipleExercises !== 'boolean' ||
        !Array.isArray(parsed.candidates)) {
        throw new MalformedAiResponseError('Assistant JSON does not match the workout response contract');
    }
    assertExactKeys(parsed, [
        'exerciseName', 'reps', 'sets', 'weight', 'weightRequired', 'multipleExercises', 'candidates',
    ], 'Assistant JSON');

    return {...parsed, candidates: parsed.candidates.map(parseCandidate)} as StructuredWorkoutReply;
}

function extractMcpCandidates(response: BedrockResponse): ExerciseSearchCandidate[] {
    const toolResult = extractMcpToolOutput(response, McpToolName.SearchExercises);
    try {
        if (!isRecord(toolResult) || !Array.isArray(toolResult.items)) {
            throw new McpToolError('MCP tool output does not contain items[]');
        }
        return toolResult.items.map(parseCandidate);
    } catch (error) {
        if (error instanceof McpToolError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new McpToolError(`MCP tool returned malformed output: ${message}`);
    }
}

function parseCandidate(value: unknown): ExerciseSearchCandidate {
    if (!isRecord(value) || typeof value.exerciseId !== 'number' || !Number.isInteger(value.exerciseId) ||
        typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.score !== 'number' ||
        !(typeof value.imageKey === 'string' || value.imageKey === null)) {
        throw new MalformedAiResponseError('Candidate does not match the structured candidate contract');
    }
    assertExactKeys(value, ['exerciseId', 'id', 'name', 'score', 'imageKey'], 'Candidate');
    return {
        exerciseId: value.exerciseId,
        id: value.id,
        name: value.name,
        score: value.score,
        imageKey: value.imageKey,
    };
}

function toParsedExercise(reply: StructuredWorkoutReply): ParsedWorkoutExercise | null {
    const name = reply.exerciseName.trim();
    if (!name || reply.reps == null || reply.sets == null || reply.multipleExercises ||
        (reply.weightRequired && reply.weight == null)) {
        return null;
    }
    return {name, reps: reply.reps, sets: reply.sets, weight: reply.weight};
}

function parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new MalformedAiResponseError('Expected JSON in Bedrock or MCP output');
    }
}

function isNullableNumber(value: unknown): value is number | null {
    return typeof value === 'number' || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value as unknown[] : [];
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
    const actual = Object.keys(value).sort();
    const normalizedExpected = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
        throw new MalformedAiResponseError(`${label} contains missing or unknown fields`);
    }
}
