import {APP_TIMEZONE} from '../../../../app/config/constants.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {tgConversationStateRepository, type TgConversationStateRow} from '../../repository/tgConversationStateRepository.js';
import {
    CONVERSATION_STEP_COMPLETED,
    ConversationStartOutcome,
    type ConversationCallbackContext,
    type ConversationDefinition,
    type ConversationResponse,
    type ConversationStartResult,
    type ConversationTextContext,
} from '../conversations/model.js';
import {localizedResponse} from '../conversations/conversationResponses.js';
import type {TelegramUserAccount} from '../../model/telegram.js';
import {WORKOUT_LOGGING_END_ROUTE} from '../../routes/constants.js';
import type {WorkoutCandidate} from './workoutCandidateMatcher.js';
import {workoutCommandMenuService} from './workoutCommandMenuService.js';
import type {ParsedWorkoutExercise} from './workoutExerciseParser.js';
import type {ConfirmationAction, HandleConfirmationResponseResult} from './workoutLoggingService.js';
import {
    EndSessionOutcome,
    HandleConfirmationResponseOutcome,
    StartSessionOutcome,
    workoutLoggingService,
} from './workoutLoggingService.js';

export const CONVERSATION_TYPE_WORKOUT_LOGGING = 'WORKOUT_LOGGING';

const CONVERSATION_STEP_WAITING_INPUT = 'WAITING_INPUT';
const CONVERSATION_STEP_WAITING_CONFIRMATION = 'WAITING_CONFIRMATION';
const SESSION_TTL_MINUTES = 120;
const CONFIRM_CANDIDATE_PREFIX = 'WORKOUT:PICK:';
const KEEP_OWN_CALLBACK = 'WORKOUT:KEEP_OWN';
const REJECT_CALLBACK = 'WORKOUT:REJECT';

interface PendingConfirmation {
    rawDescription: string;
    parsedExercise: ParsedWorkoutExercise;
    candidates: WorkoutCandidate[];
}

interface WorkoutLoggingData {
    sessionId: number;
    clientId: number;
    retryUsed?: boolean;
    pending?: PendingConfirmation | null;
}

export const workoutLoggingConversation: ConversationDefinition = {
    type: CONVERSATION_TYPE_WORKOUT_LOGGING,
    initialStep: CONVERSATION_STEP_WAITING_INPUT,
    ttlMinutes: SESSION_TTL_MINUTES,
    steps: {
        [CONVERSATION_STEP_WAITING_INPUT]: {
            onText: handleWaitingInputText,
        },
        [CONVERSATION_STEP_WAITING_CONFIRMATION]: {
            onCallback: handleConfirmationCallback,
            onText: handleWaitingConfirmationText,
        },
    },
    onStart: startWorkoutLoggingSession,
    onCancel: cancelWorkoutLoggingSession,
    onPreempt: preemptWorkoutLoggingSession,
    onExpire: expireWorkoutLoggingSession,
};

async function startWorkoutLoggingSession(user: TelegramUserAccount): Promise<ConversationStartResult> {
    const startResult = await workoutLoggingService.startSession({
        clientId: user.clientId ?? null,
        now: new Date(),
        timezone: APP_TIMEZONE,
    });

    if (startResult.outcome === StartSessionOutcome.NotAClient) {
        return {
            outcome: ConversationStartOutcome.Aborted,
            response: localizedResponse(user.lang, I18N_KEYS.telegram.conversations.workoutLogging.notAClient),
        };
    }

    if (startResult.outcome === StartSessionOutcome.AlreadyOpen) {
        return {
            outcome: ConversationStartOutcome.Aborted,
            response: localizedResponse(user.lang, I18N_KEYS.telegram.conversations.workoutLogging.alreadyOpen),
        };
    }

    await workoutCommandMenuService.showWorkoutActiveMenu(user);

    return {
        outcome: ConversationStartOutcome.Started,
        data: {sessionId: startResult.sessionId, clientId: user.clientId},
        response: localizedResponse(user.lang, I18N_KEYS.telegram.conversations.workoutLogging.initialMessage),
    };
}

async function cancelWorkoutLoggingSession(state: TgConversationStateRow): Promise<void> {
    await closePreemptedWorkoutSession(state);
}

async function preemptWorkoutLoggingSession(state: TgConversationStateRow): Promise<void> {
    await closePreemptedWorkoutSession(state);
}

async function expireWorkoutLoggingSession(state: TgConversationStateRow): Promise<void> {
    try {
        await workoutLoggingService.closeExpiredSession({clientId: getData(state).clientId});
    } finally {
        await workoutCommandMenuService.restoreDefaultMenu(state.chat_id);
    }
}

async function closePreemptedWorkoutSession(state: TgConversationStateRow): Promise<void> {
    try {
        await workoutLoggingService.preemptActiveSession({clientId: getData(state).clientId});
    } finally {
        await workoutCommandMenuService.restoreDefaultMenu(state.chat_id);
    }
}

async function handleWaitingInputText(context: ConversationTextContext): Promise<ConversationResponse> {
    if (context.text === WORKOUT_LOGGING_END_ROUTE) {
        return endWorkoutSession(context);
    }

    const data = getData(context.state);
    const parsed = await workoutLoggingService.handleExerciseMessage({
        sessionId: data.sessionId,
        message: context.text,
        lang: context.user.lang,
    });

    if (!parsed) {
        return handleUnclearMessage(context, data);
    }

    const {parsedExercise, candidates} = parsed;
    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        currentStep: CONVERSATION_STEP_WAITING_CONFIRMATION,
        data: {
            ...data,
            retryUsed: false,
            pending: {rawDescription: context.text, parsedExercise, candidates},
        },
    });

    return buildConfirmationResponse(context.user.lang, parsedExercise, candidates);
}

async function handleWaitingConfirmationText(context: ConversationTextContext): Promise<ConversationResponse> {
    if (context.text === WORKOUT_LOGGING_END_ROUTE) {
        return endWorkoutSession(context);
    }

    return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.unsupportedInput);
}

async function handleUnclearMessage(
    context: ConversationTextContext,
    data: WorkoutLoggingData,
): Promise<ConversationResponse> {
    if (data.retryUsed) {
        await workoutLoggingService.saveUnconfirmedEntry({sessionId: data.sessionId, rawDescription: context.text});
        await tgConversationStateRepository.updateConversation({
            id: context.state.id,
            data: {...data, retryUsed: false, pending: null},
            ttlMinutes: SESSION_TTL_MINUTES,
        });

        return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.workoutLogging.savedAsWritten, {
            description: context.text,
        });
    }

    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        data: {...data, retryUsed: true},
    });

    return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.workoutLogging.unclear);
}

async function handleConfirmationCallback(context: ConversationCallbackContext): Promise<ConversationResponse> {
    const data = getData(context.state);
    const pending = data.pending;

    if (!pending) {
        return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.unsupportedAction);
    }

    if (context.callbackData === REJECT_CALLBACK) {
        return rejectPending(context, data);
    }

    const {action, candidateExerciseId, valid} = resolveConfirmationAction(context.callbackData);
    if (!valid) {
        return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.unsupportedAction);
    }

    const result = await workoutLoggingService.handleConfirmationResponse({
        sessionId: data.sessionId,
        action,
        rawDescription: pending.rawDescription,
        parsedExercise: pending.parsedExercise,
        candidateExerciseId,
    });

    return afterEntrySaved(context, data, result, pending);
}

function resolveConfirmationAction(callbackData: string): {
    action: ConfirmationAction;
    candidateExerciseId: number | null;
    valid: boolean;
} {
    if (callbackData === KEEP_OWN_CALLBACK) {
        return {action: 'confirm-own', candidateExerciseId: null, valid: true};
    }

    if (callbackData.startsWith(CONFIRM_CANDIDATE_PREFIX)) {
        const candidateExerciseId = Number(callbackData.slice(CONFIRM_CANDIDATE_PREFIX.length));
        if (!Number.isNaN(candidateExerciseId)) {
            return {action: 'confirm-candidate', candidateExerciseId, valid: true};
        }
    }

    return {action: 'confirm-own', candidateExerciseId: null, valid: false};
}

async function rejectPending(
    context: ConversationCallbackContext,
    data: WorkoutLoggingData,
): Promise<ConversationResponse> {
    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        currentStep: CONVERSATION_STEP_WAITING_INPUT,
        data: {...data, retryUsed: true, pending: null},
    });

    return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.workoutLogging.unclear);
}

async function afterEntrySaved(
    context: ConversationCallbackContext,
    data: WorkoutLoggingData,
    result: HandleConfirmationResponseResult,
    pending: PendingConfirmation,
): Promise<ConversationResponse> {
    if (result.outcome === HandleConfirmationResponseOutcome.Retry) {
        return rejectPending(context, data);
    }

    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        currentStep: CONVERSATION_STEP_WAITING_INPUT,
        data: {...data, retryUsed: false, pending: null},
        ttlMinutes: SESSION_TTL_MINUTES,
    });

    const key =
        result.outcome === HandleConfirmationResponseOutcome.SavedLinked
            ? I18N_KEYS.telegram.conversations.workoutLogging.savedLinked
            : I18N_KEYS.telegram.conversations.workoutLogging.savedUnlinked;

    return localizedResponse(context.user.lang, key, {exercise: pending.parsedExercise.name});
}

async function endWorkoutSession(context: ConversationTextContext): Promise<ConversationResponse> {
    const data = getData(context.state);
    const result = await workoutLoggingService.endSession({clientId: data.clientId});

    await tgConversationStateRepository.deactivateConversation({
        id: context.state.id,
        finalStep: CONVERSATION_STEP_COMPLETED,
    });
    await workoutCommandMenuService.restoreDefaultMenu(context.user.chatId);

    const key =
        result.outcome === EndSessionOutcome.EndedRecorded
            ? I18N_KEYS.telegram.conversations.workoutLogging.sessionComplete
            : I18N_KEYS.telegram.conversations.workoutLogging.sessionEmpty;

    return localizedResponse(context.user.lang, key);
}

function buildConfirmationResponse(
    lang: string | null | undefined,
    parsedExercise: ParsedWorkoutExercise,
    candidates: WorkoutCandidate[],
): ConversationResponse {
    const weightText = parsedExercise.weight != null ? ` @ ${parsedExercise.weight}kg` : '';
    const text = i18nService.tr(lang, I18N_KEYS.telegram.conversations.workoutLogging.confirmation, {
        exercise: parsedExercise.name,
        reps: parsedExercise.reps,
        sets: parsedExercise.sets,
        weight: weightText,
    });

    const candidateButtons = candidates.map((candidate, index) => [
        {
            text: buildCandidateLabel(candidate, index, candidates.length),
            callback_data: `${CONFIRM_CANDIDATE_PREFIX}${candidate.exerciseId}`,
        },
    ]);
    const media = candidates
        .map((candidate, index) =>
            candidate.imageUrl
                ? {url: candidate.imageUrl, caption: buildCandidateLabel(candidate, index, candidates.length)}
                : null,
        )
        .filter((entry): entry is {url: string; caption: string} => entry != null);

    return {
        text,
        media: media.length ? media : undefined,
        replyMarkup: {
            inline_keyboard: [
                ...candidateButtons,
                [
                    {
                        text: i18nService.tr(lang, I18N_KEYS.telegram.conversations.workoutLogging.buttonKeepOwn),
                        callback_data: KEEP_OWN_CALLBACK,
                    },
                    {
                        text: i18nService.tr(lang, I18N_KEYS.telegram.conversations.workoutLogging.buttonReject),
                        callback_data: REJECT_CALLBACK,
                    },
                ],
            ],
        },
    };
}

function buildCandidateLabel(candidate: WorkoutCandidate, index: number, total: number): string {
    return total > 1 ? `${index + 1}. ${candidate.name}` : candidate.name;
}

function getData(state: TgConversationStateRow): WorkoutLoggingData {
    const data = state.data;
    if (isRecord(data) && typeof data.sessionId === 'number' && typeof data.clientId === 'number') {
        return data as unknown as WorkoutLoggingData;
    }

    throw new Error(`workoutLoggingConversation: invalid state.data for conversation ${state.id}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
