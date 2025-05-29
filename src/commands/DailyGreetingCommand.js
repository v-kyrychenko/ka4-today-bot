import {BaseCommand} from "./BaseCommand.js";
import {DAILY_GREETING_COMMAND} from "./registry.js";
import {DEFAULT_LANG} from "../config/constants.js";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";
import {dynamoDbService} from "../services/dynamoDbService.js";
import {BadRequestError} from "../utils/errors.js";

export class DailyGreetingCommand extends BaseCommand {
    canHandle(text) {
        return text === DAILY_GREETING_COMMAND;
    }

    async execute(context) {
        //TODO think about retrieving language_code from context (user available in cron)
        const user = await dynamoDbService.getUser(context.chatId)
        const lang = user.language_code || DEFAULT_LANG
        const promptRef = context.message.promptRef

        if (!promptRef) {
            throw new BadRequestError(`🟡 promptRef missing in context:${context}`)
        }

        const assistantReply = await openAiService
            .fetchOpenAiReply({lang: lang, promptRef: promptRef})

        await telegramService.sendMessage(context.chatId, assistantReply);
    }
}

