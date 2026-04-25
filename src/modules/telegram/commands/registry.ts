import {StartCommand} from './StartCommand.js';
import {DefaultCommand} from './DefaultCommand.js';
import {DailyGreetingCommand} from './DailyGreetingCommand.js';
import {DailyWorkoutCommand} from './DailyWorkoutCommand.js';
import {ProgressCommand} from './progress/ProgressCommand.js';
import type {BaseCommand} from './BaseCommand.js';

export const START_COMMAND = '/start';
export const DEFAULT_COMMAND = '42';
export const DAILY_GREETING_COMMAND = '/daily_greeting';
export const DAILY_WORKOUT_COMMAND = '/generate_daily_workout';
export const PROGRESS_COMMAND = '/progress';

export const commandRegistry: BaseCommand[] = [
    new StartCommand(),
    new DefaultCommand(),
    new DailyGreetingCommand(),
    new DailyWorkoutCommand(),
    new ProgressCommand(),
];
