import {openAiClient} from '../../../../infrastructure/integrations/openai/openAiClient.js';
import {OpenAIError} from '../../../../shared/errors';
import {DEFAULT_MODEL, DEFAULT_TEMPERATURE} from '../../../../shared/types/openai.js';
import type {OpenAiResponseDetails, OpenAiTextFormat} from '../../../../shared/types/openai.js';
import {parseJsonFromText} from '../../../../shared/utils/json.js';

export interface ParsedWorkoutExercise {
    name: string;
    reps: number;
    sets: number;
    weight: number | null;
}

export type ParseExerciseMessageResult =
    | {outcome: 'parsed'; exercise: ParsedWorkoutExercise}
    | {outcome: 'unclear'; exercise: null};

export interface ParseExerciseMessageRequest {
    message: string;
    lang?: string | null;
}

interface ExerciseParseReply {
    exerciseName: unknown;
    reps: unknown;
    sets: unknown;
    weight: unknown;
    weightRequired: unknown;
    multipleExercises: unknown;
}

const UNCLEAR_RESULT: ParseExerciseMessageResult = {outcome: 'unclear', exercise: null};

const SYSTEM_PROMPT =
    'You extract a single logged exercise from a client message written in any language. ' +
    'Reply with a single JSON object matching the given schema: ' +
    'exerciseName (string, translated to English), reps (number of repetitions per set, or null if not stated), ' +
    'sets (number of sets, or null if not stated), weight (the load used, in the unit given by the client, or null ' +
    'if not stated), weightRequired (true when the exercise is a weighted/resistance exercise so a missing weight ' +
    'makes the message incomplete, false for bodyweight/cardio exercises where no weight is expected), and ' +
    'multipleExercises (true when the message describes more than one distinct exercise). Do not include any text ' +
    'outside of the JSON object.';

const EXERCISE_PARSE_TEXT_FORMAT: OpenAiTextFormat = {
    format: {
        type: 'json_schema',
        name: 'workout_exercise_parse',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['exerciseName', 'reps', 'sets', 'weight', 'weightRequired', 'multipleExercises'],
            properties: {
                exerciseName: {type: 'string'},
                reps: {type: ['number', 'null']},
                sets: {type: ['number', 'null']},
                weight: {type: ['number', 'null']},
                weightRequired: {type: 'boolean'},
                multipleExercises: {type: 'boolean'},
            },
        },
    },
};

export async function parseExerciseMessage(request: ParseExerciseMessageRequest): Promise<ParseExerciseMessageResult> {
    const response = await openAiClient.createResponse({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: request.message,
        model: DEFAULT_MODEL,
        temperature: DEFAULT_TEMPERATURE,
        textFormat: EXERCISE_PARSE_TEXT_FORMAT,
    });

    const reply = parseExerciseParseReply(extractAssistantReply(response));
    return reply ? toParseResult(reply) : UNCLEAR_RESULT;
}

function toParseResult(reply: ExerciseParseReply): ParseExerciseMessageResult {
    const name = typeof reply.exerciseName === 'string' ? reply.exerciseName.trim() : '';
    const reps = typeof reply.reps === 'number' ? reply.reps : null;
    const sets = typeof reply.sets === 'number' ? reply.sets : null;
    const weight = typeof reply.weight === 'number' ? reply.weight : null;
    const weightRequired = reply.weightRequired === true;
    const multipleExercises = reply.multipleExercises === true;

    if (!name || reps == null || sets == null || multipleExercises || (weightRequired && weight == null)) {
        return UNCLEAR_RESULT;
    }

    return {outcome: 'parsed', exercise: {name, reps, sets, weight}};
}

function parseExerciseParseReply(text: string): ExerciseParseReply | null {
    try {
        const parsed = parseJsonFromText(text);
        return isExerciseParseReply(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isExerciseParseReply(value: unknown): value is ExerciseParseReply {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractAssistantReply(response: OpenAiResponseDetails): string {
    if (!Array.isArray(response.output)) {
        throw new OpenAIError('Invalid messages format: expected output[] array');
    }

    const assistantMessages = response.output
        .filter((message) => message.role === 'assistant')
        .sort((left, right) => right.created_at - left.created_at);

    if (!assistantMessages.length) {
        throw new OpenAIError('No assistant messages found in thread');
    }

    const textPart = assistantMessages[0].content.find(
        (part): part is {type: 'output_text'; text: string} => part.type === 'output_text' && typeof part.text === 'string',
    );

    if (!textPart) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return textPart.text;
}
