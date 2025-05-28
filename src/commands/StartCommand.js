import {userService} from "../services/userService.js";
import {BaseCommand} from "./BaseCommand.js";

export class StartCommand extends BaseCommand {
    canHandle(text) {
        return text === "/start";
    }

    async execute(context) {
        await userService.ensureUserExists(context)
    }
}
