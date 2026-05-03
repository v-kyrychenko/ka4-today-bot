import type {TgConversationStateRow} from '../../repository/tgConversationStateRepository.js';
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

export interface ConversationTextContext {
    chatId: number;
    text: string;
    state: TgConversationStateRow;
}

export interface ConversationCallbackContext {
    chatId: number;
    callbackData: string;
    messageId: number;
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
    getInitialMessage: () => ConversationResponse;
}
