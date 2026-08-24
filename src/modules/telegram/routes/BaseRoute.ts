import type {ProcessorContext} from '../model/context.js';

export abstract class BaseRoute {
    /**
     * The conversation type this route starts, if any -- lets routesProcessor skip cross-context
     * pre-emption when the matched route would restart the SAME conversation type that's already
     * active (a same-type repeat-start is an application-level concern for that conversation's
     * own start step to reject, not a pre-emption).
     */
    conversationType: string | null = null;

    abstract canHandle(text: string | null, context: ProcessorContext): boolean;

    shouldSendProcessingNotice(): boolean {
        return true;
    }

    abstract execute(context: ProcessorContext): Promise<void>;
}
