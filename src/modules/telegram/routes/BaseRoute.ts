import type {ProcessorContext} from '../model/context.js';

export abstract class BaseRoute {
    abstract canHandle(text: string | null, context: ProcessorContext): boolean;

    abstract execute(context: ProcessorContext): Promise<void>;
}
