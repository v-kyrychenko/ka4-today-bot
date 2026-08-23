import {toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {workoutLogRepository} from './repository/workoutLogRepository.js';

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
    now: Date;
}

export type StartSessionOutcome = 'not-a-client' | 'already-open' | 'started';
export type EndSessionOutcome = 'no-active-session' | 'ended-empty' | 'ended-recorded';
export type PreemptActiveSessionOutcome = 'no-active-session' | 'pre-empted';
export type CloseExpiredSessionOutcome = 'no-active-session' | 'active' | 'auto-closed';

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

const CLIENT_ENDED_REASON = 'client-ended';
const PRE_EMPTED_REASON = 'pre-empted';
const AUTO_CLOSED_REASON = 'auto-closed';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const workoutLoggingService = {
    startSession,
    endSession,
    preemptActiveSession,
    closeExpiredSession,
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

export async function closeExpiredSession(request: CloseExpiredSessionRequest): Promise<CloseExpiredSessionResult> {
    const activeSession = await workoutLogRepository.findActiveByClientId(request.clientId);
    if (!activeSession) {
        return {outcome: 'no-active-session'};
    }

    const lastEntryAt = await workoutLogRepository.findLastEntryAt(activeSession.id);
    const idleSince = new Date(lastEntryAt ?? activeSession.startedAt);
    if (request.now.getTime() - idleSince.getTime() <= SESSION_TTL_MS) {
        return {outcome: 'active'};
    }

    await workoutLogRepository.closeSession(activeSession.id, AUTO_CLOSED_REASON);

    return {outcome: 'auto-closed'};
}

function toLocalSessionDay(now: Date, timezoneOffsetMinutes: number): string {
    const localTime = new Date(now.getTime() + timezoneOffsetMinutes * 60_000);

    return toIsoDate(localTime);
}
