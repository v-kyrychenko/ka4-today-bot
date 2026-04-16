import type {ProcessorContext} from '../domain/context.js';

export abstract class BaseCommand {
    abstract canHandle(text: string | null, context: ProcessorContext): boolean;

    abstract execute(context: ProcessorContext): Promise<void>;
}
