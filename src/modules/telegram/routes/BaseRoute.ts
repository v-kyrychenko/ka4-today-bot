import type {ProcessorContext} from '../model/context.js';

export enum ActiveConversationPolicy {
    /** Executes the route without changing the active conversation. */
    Preserve = 'preserve',
    /** Ends the active conversation before executing the route. */
    Preempt = 'preempt',
}

export abstract class BaseRoute {
    activeConversationPolicy = ActiveConversationPolicy.Preserve;

    abstract canHandle(text: string | null, context: ProcessorContext): boolean;

    shouldSendProcessingNotice(): boolean {
        return true;
    }

    abstract execute(context: ProcessorContext): Promise<void>;
}
