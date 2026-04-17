/**
 * @Deprecated
 */
export type JsonObject = Record<string, unknown>;

/**
 * @Deprecated
 */
export class ScheduleUser {
    chat_id = 0;
    username?: string | null;
    language_code?: string | null;
    is_active?: number;

    constructor(init?: Partial<ScheduleUser>) {
        Object.assign(this, init);
    }
}

/**
 * @Deprecated
 */
export class TrainingScheduleItem {
    chat_id = 0;
    day_of_week = '';
    prompt_ref?: string;
    plan?: unknown; // TODO remove or redesign during deprecated schedule rework
    user?: ScheduleUser;

    constructor(init?: Partial<TrainingScheduleItem>) {
        Object.assign(this, init);
        this.user = init?.user ? new ScheduleUser(init.user) : undefined;
    }
}
