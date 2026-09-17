import {BadRequestError} from '../../../../shared/errors';
import {assertAllowedKeys} from '../../../../shared/http/apiHelpers.js';
import {log} from '../../../../shared/logging';
import {searchExerciseCandidates} from '../application/searchExerciseCandidates.js';

const ALLOWED_INPUT_KEYS = ['query', 'limit'];
const MIN_LIMIT = 1;
const MAX_LIMIT = 10;

export async function handleSearchExercises(input: unknown) {
    if (!isRecord(input)) {
        throw new BadRequestError('Tool input must be an object');
    }

    assertAllowedKeys(input, ALLOWED_INPUT_KEYS);
    const query = parseQuery(input.query);
    const limit = parseLimit(input.limit);
    log('[mcp.search_exercises] Request validated', {query, requestedLimit: limit});
    return searchExerciseCandidates({query, ...(limit === undefined ? {} : {limit})});
}

function parseQuery(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestError("Field 'query' is required and must be a non-empty string");
    }
    return value.trim();
}

function parseLimit(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || (value as number) < MIN_LIMIT || (value as number) > MAX_LIMIT) {
        throw new BadRequestError(`Field 'limit' must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`);
    }
    return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
