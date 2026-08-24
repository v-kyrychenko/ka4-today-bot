import {bodyMeasurementsConversation} from '../measurements/bodyMeasurementsConversation.js';
import {workoutLoggingConversation} from '../workoutLogging/workoutLoggingConversation.js';
import type {ConversationDefinition} from './model.js';

const conversationDefinitions: ConversationDefinition[] = [bodyMeasurementsConversation, workoutLoggingConversation];

export function getConversationDefinition(type: string): ConversationDefinition | null {
    return conversationDefinitions.find((item) => item.type === type) ?? null;
}
