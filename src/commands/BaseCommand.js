export class BaseCommand {
    canHandle(text, context) {
        throw new Error("canHandle() not implemented");
    }

    async execute(context) {
        throw new Error("execute() not implemented");
    }
}
