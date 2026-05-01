import {
    tgConversationStateRepository,
    type TgConversationStateRow,
} from '../../repository/tgConversationStateRepository.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {
    CONVERSATION_STEP_CANCELLED,
    CONVERSATION_STEP_FAILED,
    type ConversationResponse,
    type ConversationType,
} from './model.js';
import {getConversationDefinition} from './registry.js';

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
};

export async function start(chatId: number, type: ConversationType | string): Promise<ConversationResponse> {
    const definition = getConversationDefinition(type);
    if (!definition) {
        return SAFE_ERROR_RESPONSE;
    }

    await tgConversationStateRepository.startConversation({
        chatId,
        type: definition.type,
        currentStep: definition.initialStep,
    });

    return definition.getInitialMessage();
}

export async function handleText(chatId: number, text: string): Promise<ConversationResponse | null> {
    const state = await tgConversationStateRepository.findActiveByChatId(chatId);
    if (!state) {
        // Let the normal route processor handle messages outside conversations.
        return null;
    }

    const step = await resolveStepOrFail(state);
    if (!step) {
        return SAFE_ERROR_RESPONSE;
    }

    if (!step.onText) {
        return UNSUPPORTED_INPUT_RESPONSE;
    }

    return step.onText({chatId, text, state});
}

export async function handleCallback(
    chatId: number,
    callbackData: string,
    messageId: number
): Promise<ConversationResponse | null> {
    const state = await tgConversationStateRepository.findActiveByChatId(chatId);
    if (!state) {
        // Callback may belong to an old message after the conversation ended.
        return null;
    }

    const step = await resolveStepOrFail(state);
    if (!step) {
        return SAFE_ERROR_RESPONSE;
    }

    if (!step.onCallback) {
        return UNSUPPORTED_ACTION_RESPONSE;
    }

    return step.onCallback({chatId, callbackData, messageId, state});
}

export async function cancel(chatId: number): Promise<ConversationResponse | null> {
    const state = await tgConversationStateRepository.deactivateActiveByChatId(
        chatId,
        CONVERSATION_STEP_CANCELLED,
    );

    return state ? CANCELLED_RESPONSE : null;
}

async function resolveStepOrFail(state: TgConversationStateRow) {
    const definition = getConversationDefinition(state.type);
    const step = definition?.steps[state.current_step];

    if (!definition || !step) {
        // Stored state is no longer supported by the registered conversation definitions.
        await tgConversationStateRepository.deactivateConversation({
            id: state.id,
            finalStep: CONVERSATION_STEP_FAILED,
        });
        return null;
    }

    return step;
}
