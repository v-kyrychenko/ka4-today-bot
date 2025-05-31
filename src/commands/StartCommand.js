import {dynamoDbService} from "../services/dynamoDbService.js";
import {BaseCommand} from "./BaseCommand.js";
import {START_COMMAND} from "./registry.js";

export class StartCommand extends BaseCommand {
    canHandle(text) {
        return text === START_COMMAND;
    }

    async execute(context) {
        await dynamoDbService.ensureUserExists(context)
    }
}
