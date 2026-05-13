import {StartRoute} from './StartRoute.js';
import {DefaultRoute} from './DefaultRoute.js';
import {DailyGreetingRoute} from './DailyGreetingRoute.js';
import {DailyWorkoutRoute} from './DailyWorkoutRoute.js';
import {ProgressRoute} from './ProgressRoute.js';
import {MeasurementsRoute} from './MeasurementsRoute.js';
import type {BaseRoute} from './BaseRoute.js';
import {DailyMealsRoute} from "./DailyMealsRoute";
export {
    CANCEL_COMMANDS,
    DAILY_GREETING_ROUTE,
    DAILY_WORKOUT_ROUTE,
    DAILY_MEALS,
    DEFAULT_ROUTE,
    MEASUREMENTS_ROUTE,
    PROGRESS_ROUTE,
    START_ROUTE,
} from './constants.js';

export const routeRegistry: BaseRoute[] = [
    new StartRoute(),
    new DefaultRoute(),
    new DailyGreetingRoute(),
    new DailyWorkoutRoute(),
    new DailyMealsRoute(),
    new ProgressRoute(),
    new MeasurementsRoute(),
];
