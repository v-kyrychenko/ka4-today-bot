import {BaseCommand} from "./BaseCommand.js";
import {START_COMMAND} from "./registry.js";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";

export class StartCommand extends BaseCommand {
    canHandle(text) {
        return text === START_COMMAND;
    }

    async execute(context) {
        const promptRef = "welcome_greeting"

        const replay = await openAiService.fetchOpenAiReply({context, promptRef})
        await telegramService.sendMessage(context, replay);
    }
}
