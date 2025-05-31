import {StartCommand} from "./StartCommand.js";
import {DefaultCommand} from "./DefaultCommand.js";
import {DailyGreetingCommand} from "./DailyGreetingCommand.js";

export const START_COMMAND = "/start"
export const DEFAULT_COMMAND = "42"
export const DAILY_GREETING_COMMAND = "/daily_greeting"

export const commandRegistry = [
    new StartCommand(),
    new DefaultCommand(),
    new DailyGreetingCommand(),
];