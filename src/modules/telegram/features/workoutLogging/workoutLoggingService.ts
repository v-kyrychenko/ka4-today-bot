import {toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {workoutLogRepository} from './repository/workoutLogRepository.js';
import {matchCandidates} from './workoutCandidateMatcher.js';
import type {WorkoutCandidate} from './workoutCandidateMatcher.js';
import {parseExerciseMessage} from './workoutExerciseParser.js';
import type {ParsedWorkoutExercise} from './workoutExerciseParser.js';

export interface StartSessionRequest {
    clientId: number | null;
    now: Date;
    timezoneOffsetMinutes: number;
}

export interface EndSessionRequest {
    clientId: number;
}

export interface PreemptActiveSessionRequest {
    clientId: number;
}

export interface CloseExpiredSessionRequest {
    clientId: number;
}

export interface HandleExerciseMessageRequest {
    sessionId: number;
    message: string;
    lang: string;
}

export type StartSessionOutcome = 'not-a-client' | 'already-open' | 'started';
export type EndSessionOutcome = 'no-active-session' | 'ended-empty' | 'ended-recorded';
export type PreemptActiveSessionOutcome = 'no-active-session' | 'pre-empted';
export type CloseExpiredSessionOutcome = 'no-active-session' | 'auto-closed';
export type HandleExerciseMessageOutcome = 'confirmation-proposed' | 'unclear';

export interface StartSessionResult {
    outcome: StartSessionOutcome;
}

export interface EndSessionResult {
    outcome: EndSessionOutcome;
}

export interface PreemptActiveSessionResult {
    outcome: PreemptActiveSessionOutcome;
}

export interface CloseExpiredSessionResult {
    outcome: CloseExpiredSessionOutcome;
}

export interface HandleExerciseMessageResult {
    outcome: HandleExerciseMessageOutcome;
    parsedExercise?: ParsedWorkoutExercise;
    candidates?: WorkoutCandidate[];
    retryRemaining?: boolean;
}

export type ConfirmationAction = 'confirm-candidate' | 'confirm-own' | 'reject';

export interface HandleConfirmationResponseRequest {
    sessionId: number;
    action: ConfirmationAction;
    rawDescription: string;
    parsedExercise: ParsedWorkoutExercise;
    candidateExerciseId?: number | null;
}

export type HandleConfirmationResponseOutcome = 'saved-linked' | 'saved-unlinked' | 'retry';

export interface HandleConfirmationResponseResult {
    outcome: HandleConfirmationResponseOutcome;
}

export interface SaveUnconfirmedEntryRequest {
    sessionId: number;
    rawDescription: string;
}

export interface SaveUnconfirmedEntryResult {
    outcome: 'saved-unconfirmed';
}

const CLIENT_ENDED_REASON = 'client-ended';
const PRE_EMPTED_REASON = 'pre-empted';
const AUTO_CLOSED_REASON = 'auto-closed';

export const workoutLoggingService = {
    startSession,
    endSession,
    preemptActiveSession,
    closeExpiredSession,
    handleExerciseMessage,
    handleConfirmationResponse,
    saveUnconfirmedEntry,
};

export async function startSession(request: StartSessionRequest): Promise<StartSessionResult> {
    if (!request.clientId) {
        return {outcome: 'not-a-client'};
    }

    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (activeSession) {
        return {outcome: 'already-open'};
    }

    await workoutLogRepository.startSession({
        clientId: request.clientId,
        sessionDay: toLocalSessionDay(request.now, request.timezoneOffsetMinutes),
        startedAt: request.now.toISOString(),
    });

    return {outcome: 'started'};
}

export async function endSession(request: EndSessionRequest): Promise<EndSessionResult> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return {outcome: 'no-active-session'};
    }

    const entryCount = await workoutLogRepository.countEntries(activeSession.id);
    await workoutLogRepository.closeSession(activeSession.id, CLIENT_ENDED_REASON);

    return {outcome: entryCount > 0 ? 'ended-recorded' : 'ended-empty'};
}

export async function preemptActiveSession(
    request: PreemptActiveSessionRequest,
): Promise<PreemptActiveSessionResult> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return {outcome: 'no-active-session'};
    }

    await workoutLogRepository.closeSession(activeSession.id, PRE_EMPTED_REASON);

    return {outcome: 'pre-empted'};
}

/**
 * Closes the client's open workout_log_session as auto-closed. Called as the onExpire hook once
 * the generic conversation engine has already determined the conversation's TTL lapsed (AC-11) --
 * the 2h idle window itself is enforced by that TTL (refreshed on every recorded exercise), not
 * recomputed here.
 */
export async function closeExpiredSession(request: CloseExpiredSessionRequest): Promise<CloseExpiredSessionResult> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return {outcome: 'no-active-session'};
    }

    await workoutLogRepository.closeSession(activeSession.id, AUTO_CLOSED_REASON);

    return {outcome: 'auto-closed'};
}

export async function handleExerciseMessage(
    request: HandleExerciseMessageRequest,
): Promise<HandleExerciseMessageResult> {
    const parseResult = await parseExerciseMessage({message: request.message, lang: request.lang});
    if (parseResult.outcome === 'unclear') {
        return {outcome: 'unclear', retryRemaining: true};
    }

    const matchResult = await matchCandidates({parsedExercise: parseResult.exercise});
    const candidates = matchResult.outcome === 'matched' ? matchResult.candidates : [];

    return {outcome: 'confirmation-proposed', parsedExercise: parseResult.exercise, candidates};
}

export async function handleConfirmationResponse(
    request: HandleConfirmationResponseRequest,
): Promise<HandleConfirmationResponseResult> {
    if (request.action === 'reject') {
        return {outcome: 'retry'};
    }

    const dictExerciseId = request.action === 'confirm-candidate' ? (request.candidateExerciseId ?? null) : null;

    await workoutLogRepository.addEntry({
        sessionId: request.sessionId,
        dictExerciseId,
        rawDescription: request.rawDescription,
        reps: request.parsedExercise.reps,
        sets: request.parsedExercise.sets,
        weight: request.parsedExercise.weight,
    });

    return {outcome: dictExerciseId != null ? 'saved-linked' : 'saved-unlinked'};
}

export async function saveUnconfirmedEntry(request: SaveUnconfirmedEntryRequest): Promise<SaveUnconfirmedEntryResult> {
    await workoutLogRepository.addEntry({
        sessionId: request.sessionId,
        dictExerciseId: null,
        rawDescription: request.rawDescription,
        reps: null,
        sets: null,
        weight: null,
    });

    return {outcome: 'saved-unconfirmed'};
}

function toLocalSessionDay(now: Date, timezoneOffsetMinutes: number): string {
    const localTime = new Date(now.getTime() + timezoneOffsetMinutes * 60_000);

    return toIsoDate(localTime);
}
