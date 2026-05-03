import type {TgConversationStateRow} from '../../repository/tgConversationStateRepository.js';
import type {TelegramUserAccount} from '../../model/telegram.js';
import type {ConversationType} from '../measurements/bodyMeasurementsModel.js';

export const CONVERSATION_STEP_WAITING_INPUT = 'WAITING_INPUT';
export const CONVERSATION_STEP_WAITING_MISSING_FIELDS = 'WAITING_MISSING_FIELDS';
export const CONVERSATION_STEP_WAITING_CONFIRMATION = 'WAITING_CONFIRMATION';
export const CONVERSATION_STEP_COMPLETED = 'COMPLETED';
export const CONVERSATION_STEP_CANCELLED = 'CANCELLED';
export const CONVERSATION_STEP_EXPIRED = 'EXPIRED';
export const CONVERSATION_STEP_FAILED = 'FAILED';

export type ConversationStepName =
    | typeof CONVERSATION_STEP_WAITING_INPUT
    | typeof CONVERSATION_STEP_WAITING_MISSING_FIELDS
    | typeof CONVERSATION_STEP_WAITING_CONFIRMATION
    | typeof CONVERSATION_STEP_COMPLETED
    | typeof CONVERSATION_STEP_CANCELLED
    | typeof CONVERSATION_STEP_EXPIRED
    | typeof CONVERSATION_STEP_FAILED;

export interface ConversationResponse {
    text: string;
    replyMarkup?: unknown;
}

export interface ConversationTextInput {
    text: string;
    user: TelegramUserAccount;
}

export interface ConversationCallbackInput {
    callbackData: string;
    messageId: number;
    user: TelegramUserAccount;
}

export interface ConversationStartInput {
    type: ConversationType | string;
    user: TelegramUserAccount;
}

export interface ConversationTextContext extends ConversationTextInput {
    state: TgConversationStateRow;
}

export interface ConversationCallbackContext extends ConversationCallbackInput {
    state: TgConversationStateRow;
}

export interface ConversationStep {
    onText?: (context: ConversationTextContext) => Promise<ConversationResponse>;
    onCallback?: (context: ConversationCallbackContext) => Promise<ConversationResponse>;
}

export interface ConversationDefinition {
    type: ConversationType;
    initialStep: ConversationStepName;
    ttlMinutes?: number;
    steps: Record<string, ConversationStep>;
    getInitialMessage: (user: TelegramUserAccount) => ConversationResponse;
}
