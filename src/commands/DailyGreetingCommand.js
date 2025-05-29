import {BaseCommand} from "./BaseCommand.js";
import {DAILY_GREETING_COMMAND} from "./registry.js";
import {DEFAULT_LANG} from "../config/constants.js";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";
import {dynamoDbService} from "../services/dynamoDbService.js";

export class DailyGreetingCommand extends BaseCommand {
    canHandle(text) {
        return text === DAILY_GREETING_COMMAND;
    }

    async execute(context) {
        const user = await dynamoDbService.getUser(context.chatId)
        const lang = user.language_code || DEFAULT_LANG
        const promptRef = "chest_default"

        const assistantReply = await openAiService
            .fetchOpenAiReply({lang: lang, promptRef: promptRef})

        await telegramService.sendMessage(context.chatId, assistantReply);
    }
}

