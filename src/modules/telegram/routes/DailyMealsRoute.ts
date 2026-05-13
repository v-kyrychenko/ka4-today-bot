import {BaseRoute} from "./BaseRoute";
import {ProcessorContext} from "../model/context";
import {DAILY_MEALS} from "./constants";

export class DailyMealsRoute extends BaseRoute {
    canHandle(text: string | null, context: ProcessorContext): boolean {
        return text === DAILY_MEALS;
    }

    execute(context: ProcessorContext): Promise<void> {
        return Promise.resolve(undefined);
    }

}