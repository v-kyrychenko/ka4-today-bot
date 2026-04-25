import {PromptDict} from './prompt.js';
import {TelegramUser} from './user.js';

export class Exercise {
    name = '';
    instructions = '';
    images: string[] = [];

    constructor(init?: Partial<Exercise>) {
        Object.assign(this, init);
        this.images = init?.images ?? [];
    }
}

export class ExerciseWithSignedImages extends Exercise {
    signedImages: string[] = [];

    constructor(init?: Partial<ExerciseWithSignedImages>) {
        super(init);
        this.signedImages = init?.signedImages ?? [];
    }
}

export class Workout {
    id = 0;
    plan: unknown = null;

    constructor(init?: Partial<Workout>) {
        Object.assign(this, init);
    }
}

export class WorkoutSchedule {
    id = 0;
    dayOfWeek = '';
    client = new TelegramUser();
    dictPrompt = new PromptDict();
    workout: Workout | null = null;

    constructor(init?: Partial<WorkoutSchedule>) {
        Object.assign(this, init);
        this.client = new TelegramUser(init?.client);
        this.dictPrompt = new PromptDict(init?.dictPrompt);
        this.workout = init?.workout ? new Workout(init.workout) : null;
    }
}
