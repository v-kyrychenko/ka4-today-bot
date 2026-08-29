import type {TgConversationStateRow} from '../../repository/tgConversationStateRepository.js';
import type {TelegramUserAccount} from '../../model/telegram.js';

export type ConversationType = string;

export const CONVERSATION_STEP_COMPLETED = 'COMPLETED';
export const CONVERSATION_STEP_CANCELLED = 'CANCELLED';
export const CONVERSATION_STEP_EXPIRED = 'EXPIRED';
export const CONVERSATION_STEP_FAILED = 'FAILED';
export const CONVERSATION_STEP_PREEMPTED = 'PREEMPTED';

export interface ConversationResponse {
    text: string;
    replyMarkup?: unknown;
    removeReplyMarkup?: boolean;
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
    type: ConversationType;
    user: TelegramUserAccount;
}

export type ConversationStartResult =
    | {
    outcome: 'started';
    /** Seeds the new conversation's stored data (e.g. a domain record id/ownership key the type's own hooks and steps need). */
    data?: unknown;
    response: ConversationResponse;
}
    | { outcome: 'aborted'; response: ConversationResponse };

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
    initialStep: string;
    ttlMinutes?: number;
    steps: Record<string, ConversationStep>;
    /**
     * Called by the generic engine to seed or veto a new conversation
     * (e.g. eligibility/duplicate checks) before any state is persisted.
     */
    onStart: (user: TelegramUserAccount) => Promise<ConversationStartResult>;
    /**
     * Called by the generic engine when this conversation's TTL lapses before the client's next check
     */
    onExpire?: (state: TgConversationStateRow) => Promise<void>;
    /**
     * Called by the generic engine when another interaction pre-empts this still-active conversation
     */
    onPreempt?: (state: TgConversationStateRow) => Promise<void>;
}
