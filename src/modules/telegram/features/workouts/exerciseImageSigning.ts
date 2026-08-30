import {s3Client} from '../../../../infrastructure/integrations/s3/s3Client.js';

const EXERCISE_IMAGES_BUCKET = 'ka4-today-exercises';
const EXERCISE_IMAGE_KEY_PREFIX = 'exercises/';
const IMAGE_URL_EXPIRES_IN_SECONDS = 3600;

export const exerciseImageSigning = {
    signExerciseImageUrl,
    signExerciseImageUrls,
};

export async function signExerciseImageUrl(key: string): Promise<string> {
    return s3Client.signObjectUrl({
        bucket: EXERCISE_IMAGES_BUCKET,
        key: `${EXERCISE_IMAGE_KEY_PREFIX}${key}`,
        expiresInSeconds: IMAGE_URL_EXPIRES_IN_SECONDS,
    });
}

export async function signExerciseImageUrls(keys: string[]): Promise<string[]> {
    return Promise.all(keys.map((key) => signExerciseImageUrl(key)));
}
