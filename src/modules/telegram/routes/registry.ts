import {StartRoute} from './StartRoute.js';
import {DefaultRoute} from './DefaultRoute.js';
import {DailyGreetingRoute} from './DailyGreetingRoute.js';
import {DailyWorkoutRoute} from './DailyWorkoutRoute.js';
import {ProgressRoute} from './ProgressRoute.js';
import {MeasurementsRoute} from './MeasurementsRoute.js';
import type {BaseRoute} from './BaseRoute.js';

export const START_ROUTE = '/start';
export const DEFAULT_ROUTE = '42';
export const DAILY_GREETING_ROUTE = '/daily_greeting';
export const DAILY_WORKOUT_ROUTE = '/generate_daily_workout';
export const PROGRESS_ROUTE = '/progress';
export const MEASUREMENTS_ROUTE = '/measurements';
export const CANCEL_COMMANDS = new Set(['/cancel', '/stop']);

export const routeRegistry: BaseRoute[] = [
    new StartRoute(),
    new DefaultRoute(),
    new DailyGreetingRoute(),
    new DailyWorkoutRoute(),
    new ProgressRoute(),
    new MeasurementsRoute(),
];
