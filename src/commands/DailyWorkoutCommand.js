import {BaseCommand} from "./BaseCommand.js";
import {DAILY_WORKOUT_COMMAND} from "./registry.js";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";
import {BadRequestError} from "../utils/errors.js";

export class DailyWorkoutCommand extends BaseCommand {

    canHandle(text) {
        return text === DAILY_WORKOUT_COMMAND;
    }

    async execute(context) {
        const promptRef = "daily_workout_default"

        const assistantReply = await openAiService
            .fetchOpenAiReply({context, promptRef, functions: FUNC_GET_AVAILABLE_EXERCISES})

        await telegramService.sendMessage(context, assistantReply);
    }
}

const FUNC_GET_AVAILABLE_EXERCISES = [
    {
        "name": "getAvailableExercises",
        "description": "Returns a list of available exercises for the user, " +
            "including exercise details such as equipment, level, and muscle group. " +
            "The Assistant should use this list to create a personalized workout plan for the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "chatId": {
                    "type": "string",
                    "description": "The unique identifier of the Telegram chat for which to generate the exercise list."
                }
            },
            "required": [
                "chatId"
            ]
        }
    }
]
