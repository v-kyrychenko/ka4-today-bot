import {log} from '../../../../shared/logging';
import {promptReplyService} from '../prompts/promptReplyService.js';
import {parseJsonFromText} from '../../../../shared/utils/json.js';

export interface ParsedWorkoutExercise {
    name: string;
    reps: number;
    sets: number;
    weight: number | null;
}

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

const WORKOUT_EXERCISE_PARSER_PROMPT_REF = 'workout_exercise_parser';

export async function parseExerciseMessage(request: ParseExerciseMessageRequest): Promise<ParsedWorkoutExercise | null> {
    const rawReply = await promptReplyService.fetchOpenAiReply({
        lang: request.lang,
        promptRef: WORKOUT_EXERCISE_PARSER_PROMPT_REF,
        variables: {USER_INPUT: request.message},
    });

    const reply = parseExerciseParseReply(rawReply);
    const exercise = reply ? toParsedExercise(reply) : null;

    log(exercise ?
        `Parsed exercise message: ${JSON.stringify(exercise)}` :
        `Could not parse exercise message, raw reply: ${rawReply}`,
    );

    return exercise;
}

function toParsedExercise(reply: ExerciseParseReply): ParsedWorkoutExercise | null {
    const name = typeof reply.exerciseName === 'string' ? reply.exerciseName.trim() : '';
    const reps = typeof reply.reps === 'number' ? reply.reps : null;
    const sets = typeof reply.sets === 'number' ? reply.sets : null;
    const weight = typeof reply.weight === 'number' ? reply.weight : null;
    const weightRequired = reply.weightRequired === true;
    const multipleExercises = reply.multipleExercises === true;

    if (!name || reps == null || sets == null || multipleExercises || (weightRequired && weight == null)) {
        return null;
    }

    return {name, reps, sets, weight};
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
