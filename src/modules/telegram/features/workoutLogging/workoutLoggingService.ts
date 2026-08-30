import {toIsoDateInTimeZone} from '../../../../shared/utils/dateUtils.js';
import {workoutLogRepository} from './repository/workoutLogRepository.js';
import {matchCandidates} from './workoutCandidateMatcher.js';
import type {WorkoutCandidate} from './workoutCandidateMatcher.js';
import {parseExerciseMessage} from './workoutExerciseParser.js';
import type {ParsedWorkoutExercise} from './workoutExerciseParser.js';

export interface StartSessionRequest {
    clientId: number | null;
    now: Date;
    timezone: string;
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

export enum StartSessionOutcome {
    NotAClient = 'not-a-client',
    AlreadyOpen = 'already-open',
    Started = 'started',
}

export enum EndSessionOutcome {
    NoActiveSession = 'no-active-session',
    EndedEmpty = 'ended-empty',
    EndedRecorded = 'ended-recorded',
}

export enum HandleConfirmationResponseOutcome {
    Retry = 'retry',
    SavedLinked = 'saved-linked',
    SavedUnlinked = 'saved-unlinked',
}

enum SessionEndReason {
    ClientEnded = 'client-ended',
    PreEmpted = 'pre-empted',
    AutoClosed = 'auto-closed',
}

export interface StartSessionResult {
    outcome: StartSessionOutcome;
    sessionId?: number;
}

export interface EndSessionResult {
    outcome: EndSessionOutcome;
}

export interface HandleExerciseMessageResult {
    parsedExercise: ParsedWorkoutExercise;
    candidates: WorkoutCandidate[];
}

export type ConfirmationAction = 'confirm-candidate' | 'confirm-own' | 'reject';

export interface HandleConfirmationResponseRequest {
    sessionId: number;
    action: ConfirmationAction;
    rawDescription: string;
    parsedExercise: ParsedWorkoutExercise;
    candidateExerciseId?: number | null;
}

export interface HandleConfirmationResponseResult {
    outcome: HandleConfirmationResponseOutcome;
}

export interface SaveUnconfirmedEntryRequest {
    sessionId: number;
    rawDescription: string;
}

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
        return {outcome: StartSessionOutcome.NotAClient};
    }

    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (activeSession) {
        return {outcome: StartSessionOutcome.AlreadyOpen};
    }

    const session = await workoutLogRepository.startSession({
        clientId: request.clientId,
        sessionDay: toIsoDateInTimeZone(request.now, request.timezone),
        startedAt: request.now.toISOString(),
    });

    return {outcome: StartSessionOutcome.Started, sessionId: session.id};
}

export async function endSession(request: EndSessionRequest): Promise<EndSessionResult> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return {outcome: EndSessionOutcome.NoActiveSession};
    }

    const entryCount = await workoutLogRepository.countEntries(activeSession.id);
    await workoutLogRepository.closeSession(activeSession.id, SessionEndReason.ClientEnded);

    return {outcome: entryCount > 0 ? EndSessionOutcome.EndedRecorded : EndSessionOutcome.EndedEmpty};
}

export async function preemptActiveSession(request: PreemptActiveSessionRequest): Promise<void> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return;
    }

    await workoutLogRepository.closeSession(activeSession.id, SessionEndReason.PreEmpted);
}

/**
 * Closes the client's open workout_log_session as auto-closed. Called as the onExpire hook once
 * the generic conversation engine has already determined the conversation's TTL lapsed
 */
export async function closeExpiredSession(request: CloseExpiredSessionRequest): Promise<void> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return;
    }

    await workoutLogRepository.closeSession(activeSession.id, SessionEndReason.AutoClosed);
}

export async function handleExerciseMessage(
    request: HandleExerciseMessageRequest,
): Promise<HandleExerciseMessageResult | null> {
    const parsedExercise = await parseExerciseMessage({message: request.message, lang: request.lang});
    if (!parsedExercise) {
        return null;
    }

    const candidates = (await matchCandidates({parsedExercise})) ?? [];

    return {parsedExercise, candidates};
}

export async function handleConfirmationResponse(
    request: HandleConfirmationResponseRequest,
): Promise<HandleConfirmationResponseResult> {
    if (request.action === 'reject') {
        return {outcome: HandleConfirmationResponseOutcome.Retry};
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

    return {
        outcome: dictExerciseId != null ?
            HandleConfirmationResponseOutcome.SavedLinked :
            HandleConfirmationResponseOutcome.SavedUnlinked,
    };
}

export async function saveUnconfirmedEntry(request: SaveUnconfirmedEntryRequest): Promise<void> {
    await workoutLogRepository.addEntry({
        sessionId: request.sessionId,
        dictExerciseId: null,
        rawDescription: request.rawDescription,
        reps: null,
        sets: null,
        weight: null,
    });
}
