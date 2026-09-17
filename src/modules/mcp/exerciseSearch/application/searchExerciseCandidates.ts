import {exerciseMapper} from '../../../../infrastructure/persistence/postgres/mappers/exerciseMapper.js';
import type {RankedDictExerciseRow} from '../../../../infrastructure/persistence/postgres/models/exerciseRow.js';
import {RepositorySearchError} from '../../../../shared/errors';
import {log, logError} from '../../../../shared/logging';
import {exerciseRepository} from '../../../coach/exercise/repository/exerciseRepository.js';
import type {
    ExerciseSearchCandidate,
    ExerciseSearchCandidatesResult,
} from '../domain/exerciseSearchCandidate.js';

export interface SearchExerciseCandidatesRequest {
    query: string;
    limit?: number;
}

export const EXERCISE_SEARCH_FIRST_PAGE = 1;
export const EXERCISE_CANDIDATE_LIMIT = 3;
export const HIGH_CONFIDENCE_SCORE_THRESHOLD = 300;

export async function searchExerciseCandidates(
    request: SearchExerciseCandidatesRequest,
): Promise<ExerciseSearchCandidatesResult> {
    const limit = request.limit ?? EXERCISE_CANDIDATE_LIMIT;
    const repositoryRequest = {q: request.query, page: EXERCISE_SEARCH_FIRST_PAGE, limit};
    const startedAt = Date.now();
    let items: RankedDictExerciseRow[];

    log('[mcp.search_exercises] Executing repository search', repositoryRequest);

    try {
        const result = await exerciseRepository.search(repositoryRequest);
        items = result.items;
        log('[mcp.search_exercises] Repository search completed', {
            ...repositoryRequest,
            durationMs: Date.now() - startedAt,
            resultCount: items.length,
        });
    } catch (error) {
        logError('[mcp.search_exercises] Repository search failed', {
            ...repositoryRequest,
            durationMs: Date.now() - startedAt,
            error,
        });
        const message = error instanceof Error ? error.message : String(error);
        throw new RepositorySearchError(`Exercise repository search failed: ${message}`);
    }

    const isHighConfidence = items[0]?.score >= HIGH_CONFIDENCE_SCORE_THRESHOLD;
    const selected = isHighConfidence ? items.slice(0, 1) : items.slice(0, limit);
    const result = {items: selected.map(toCandidate)};
    log('[mcp.search_exercises] Candidates selected', {
        highConfidence: isHighConfidence,
        threshold: HIGH_CONFIDENCE_SCORE_THRESHOLD,
        candidateCount: result.items.length,
    });
    return result;
}

function toCandidate(item: RankedDictExerciseRow): ExerciseSearchCandidate {
    return {
        exerciseId: item.id,
        id: item.key,
        name: item.name,
        score: item.score,
        imageKey: exerciseMapper.toStringArray(item.images)[0] ?? null,
    };
}
