import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {
    CONVERSATION_STEP_WAITING_INPUT,
    CONVERSATION_TYPE_BODY_MEASUREMENTS,
    type ConversationDefinition,
} from './model.js';

const bodyMeasurementsConversation: ConversationDefinition = {
    type: CONVERSATION_TYPE_BODY_MEASUREMENTS,
    initialStep: CONVERSATION_STEP_WAITING_INPUT,
    steps: {
        [CONVERSATION_STEP_WAITING_INPUT]: {
            async onText() {
                return {text: i18nService.tr(null, I18N_KEYS.telegram.conversations.bodyMeasurements.unavailable)};
            },
        },
    },
    getInitialMessage: () => ({
        text: i18nService.tr(null, I18N_KEYS.telegram.conversations.bodyMeasurements.initialMessage),
    }),
};

const conversationDefinitions: ConversationDefinition[] = [
    bodyMeasurementsConversation,
];

export function getConversationDefinition(type: string): ConversationDefinition | null {
    return conversationDefinitions.find((item) => item.type === type) ?? null;
}
