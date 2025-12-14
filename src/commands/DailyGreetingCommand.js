import {BaseCommand} from "./BaseCommand.js";
import {DAILY_GREETING_COMMAND} from "./registry.js";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";
import {BadRequestError} from "../utils/errors.js";

export class DailyGreetingCommand extends BaseCommand {
    canHandle(text) {
        return text === DAILY_GREETING_COMMAND;
    }

    async execute(context) {
        const promptRef = context.message.promptRef

        if (!promptRef) {
            throw new BadRequestError(`🟡 promptRef missing in context:${context}`)
        }

        const replay = await openAiService.fetchOpenAiReply({context, promptRef})
        await telegramService.sendMessage(context, replay);
    }
}

