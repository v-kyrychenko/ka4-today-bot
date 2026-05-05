import {bodyMeasurementsConversation} from '../measurements/bodyMeasurementsConversation.js';
import type {ConversationDefinition} from './model.js';

const conversationDefinitions: ConversationDefinition[] = [
    bodyMeasurementsConversation,
];

export function getConversationDefinition(type: string): ConversationDefinition | null {
    return conversationDefinitions.find((item) => item.type === type) ?? null;
}
