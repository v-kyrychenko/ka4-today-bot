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
