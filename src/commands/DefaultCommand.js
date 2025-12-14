import {BaseCommand} from "./BaseCommand.js";
import {telegramService} from "../services/telegramService.js";
import {openAiService} from "../services/openAiService.js";
import {DEFAULT_COMMAND} from "./registry.js";

export class DefaultCommand extends BaseCommand {
    canHandle(text) {
        return text === DEFAULT_COMMAND;
    }

    async execute(context) {
        const promptRef = "42_default"

        const replay = await openAiService.fetchOpenAiReply({context, promptRef})
        await telegramService.sendMessage(context, replay);
    }
}