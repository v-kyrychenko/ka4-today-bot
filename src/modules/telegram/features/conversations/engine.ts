import {
    tgConversationStateRepository,
    type TgConversationStateRow,
} from '../../repository/tgConversationStateRepository.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {log, logError} from '../../../../shared/logging';
import {
    CONVERSATION_STEP_CANCELLED,
    CONVERSATION_STEP_EXPIRED,
    CONVERSATION_STEP_FAILED,
    CONVERSATION_STEP_PREEMPTED,
    ConversationStartOutcome,
    type ConversationCallbackInput,
    type ConversationResponse,
    type ConversationStartInput,
    type ConversationTextInput,
} from './model.js';
import {getConversationDefinition} from './registry.js';

export async function start(input: ConversationStartInput): Promise<ConversationResponse> {
    const chatId = input.user.chatId;
    const definition = getConversationDefinition(input.type);
    if (!definition) {
        logError('### CONVERSATION:error', {chatId, type: input.type, reason: 'definition_not_found'});
        return SAFE_ERROR_RESPONSE;
    }

    const startResult = await definition.onStart(input.user);
    if (startResult.outcome === ConversationStartOutcome.Aborted) {
        log('### CONVERSATION:start_aborted', {chatId, type: definition.type});
        return startResult.response;
    }

    log('### CONVERSATION:start', {chatId, type: definition.type, initialStep: definition.initialStep});
    await tgConversationStateRepository.startConversation({
        chatId,
        type: definition.type,
        currentStep: definition.initialStep,
        ttlMinutes: definition.ttlMinutes,
        data: startResult.data,
    });

    return startResult.response;
}

export async function handleText(input: ConversationTextInput): Promise<ConversationResponse | null> {
    const chatId = input.user.chatId;
    const state = await resolveActiveConversation(chatId);
    if (!state) {
        // Let the normal route processor handle messages outside conversations.
        return null;
    }

    log('### CONVERSATION:loaded', {chatId, type: state.type, step: state.current_step});
    const step = await resolveStepOrFail(state);
    if (!step) {
        return SAFE_ERROR_RESPONSE;
    }

    if (!step.onText) {
        return UNSUPPORTED_INPUT_RESPONSE;
    }

    try {
        log('### CONVERSATION:step', {chatId, type: state.type, step: state.current_step, input: 'text'});
        return await step.onText({...input, state});
    } catch (error) {
        logError('### CONVERSATION:error', {chatId, type: state.type, step: state.current_step, error});
        throw error;
    }
}

export async function handleCallback(input: ConversationCallbackInput): Promise<ConversationResponse | null> {
    const chatId = input.user.chatId;
    const state = await resolveActiveConversation(chatId);
    if (!state) {
        // Callback may belong to an old message after the conversation ended.
        return null;
    }

    log('### CONVERSATION:loaded', {chatId, type: state.type, step: state.current_step});
    const step = await resolveStepOrFail(state);
    if (!step) {
        return SAFE_ERROR_RESPONSE;
    }

    if (!step.onCallback) {
        return UNSUPPORTED_ACTION_RESPONSE;
    }

    try {
        log('### CONVERSATION:step', {chatId, type: state.type, step: state.current_step, input: 'callback'});
        return await step.onCallback({...input, state});
    } catch (error) {
        logError('### CONVERSATION:error', {chatId, type: state.type, step: state.current_step, error});
        throw error;
    }
}

export async function cancel(chatId: number): Promise<ConversationResponse | null> {
    const state = await tgConversationStateRepository.deactivateActiveByChatId(chatId, CONVERSATION_STEP_CANCELLED);

    if (state) {
        log('### CONVERSATION:cancel', {chatId, type: state.type});
    }

    return state ? CANCELLED_RESPONSE : null;
}

/**
 * Ends a still-active conversation, of any type, in favor of another interaction for the same chat
 */
export async function preemptActiveConversation(chatId: number, exceptType?: string): Promise<void> {
    const state = await resolveActiveConversation(chatId);
    if (!state || state.type === exceptType) {
        return;
    }

    await tgConversationStateRepository.deactivateConversation({id: state.id, finalStep: CONVERSATION_STEP_PREEMPTED});
    log('### CONVERSATION:preempt', {chatId, type: state.type});
    await invokeLifecycleHook(state, 'onPreempt');
}

/** Reads the active row, lazily expiring it (and firing the type's onExpire hook) if its TTL lapsed. */
async function resolveActiveConversation(chatId: number): Promise<TgConversationStateRow | null> {
    const row = await tgConversationStateRepository.findRawActiveByChatId(chatId);
    if (!row) {
        return null;
    }

    if (!tgConversationStateRepository.isConversationExpired(row)) {
        return row;
    }

    await tgConversationStateRepository.deactivateConversation({id: row.id, finalStep: CONVERSATION_STEP_EXPIRED});
    log('### CONVERSATION:expire', {chatId, type: row.type});
    await invokeLifecycleHook(row, 'onExpire');
    return null;
}

async function invokeLifecycleHook(state: TgConversationStateRow, hook: 'onExpire' | 'onPreempt'): Promise<void> {
    const definition = getConversationDefinition(state.type);
    const handler = definition?.[hook];
    if (handler) {
        await handler(state);
    }
}

async function resolveStepOrFail(state: TgConversationStateRow) {
    const definition = getConversationDefinition(state.type);
    const step = definition?.steps[state.current_step];

    if (!definition || !step) {
        // Stored state is no longer supported by the registered conversation definitions.
        logError('### CONVERSATION:error', {chatId: state.chat_id, type: state.type, step: state.current_step});
        await tgConversationStateRepository.deactivateConversation({
            id: state.id,
            finalStep: CONVERSATION_STEP_FAILED,
        });
        return null;
    }

    return step;
}

const SAFE_ERROR_RESPONSE: ConversationResponse = {
    text: i18nService.tr(null, I18N_KEYS.telegram.conversations.safeError),
};

const UNSUPPORTED_ACTION_RESPONSE: ConversationResponse = {
    text: i18nService.tr(null, I18N_KEYS.telegram.conversations.unsupportedAction),
};

const UNSUPPORTED_INPUT_RESPONSE: ConversationResponse = {
    text: i18nService.tr(null, I18N_KEYS.telegram.conversations.unsupportedInput),
};

const CANCELLED_RESPONSE: ConversationResponse = {
    text: i18nService.tr(null, I18N_KEYS.telegram.conversations.cancelled),
};

export const conversationEngine = {
    start,
    handleText,
    handleCallback,
    cancel,
    preemptActiveConversation,
};
