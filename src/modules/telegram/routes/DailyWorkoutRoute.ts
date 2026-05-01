import {DAILY_WORKOUT_ROUTE} from './registry.js';
import {BaseRoute} from './BaseRoute.js';
import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {OpenAIError} from '../../../shared/errors';
import {log} from '../../../shared/logging';
import {promptReplyService} from '../features/prompts/promptReplyService.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {ProcessorContext} from './context.js';
import {Exercise, ExerciseWithSignedImages} from '../features/workouts/workout.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';

const s3 = new S3Client();

const PROMPT_REF = 'daily_workout';
const PROMPT_REF_NOT_TODAY = 'no_training_for_today';
const PROMPT_REF_NOT_NO_PLAN = 'no_plan_for_training';

export class DailyWorkoutRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DAILY_WORKOUT_ROUTE;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const chatId = context.chatId;
        if (chatId == null) {
            throw new OpenAIError('chatId is mandatory');
        }

        const scheduled = await tgUserRepository.getUserScheduledForDay(chatId);
        log(`ChatId:${chatId}, found scheduled training for today:${JSON.stringify(scheduled)}`);

        if (!scheduled) {
            const reply = await promptReplyService.fetchOpenAiReply({
                context,
                promptRef: PROMPT_REF_NOT_TODAY,
            });
            await telegramMessagingService.sendMessage(context, reply);
            return;
        }

        const plan = scheduled.workout?.plan;
        if (plan == null) {
            const message = await promptReplyService.fetchOpenAiReply({
                context,
                promptRef: PROMPT_REF_NOT_NO_PLAN,
            });
            await telegramMessagingService.sendMessage(context, message);
            return;
        }

        const reply = await promptReplyService.fetchOpenAiReply({
            context,
            promptRef: PROMPT_REF,
            variables: {plan},
        });

        const exercises = parseSafeJsonExercises(reply);
        const exercisesWithUrls = await generateSignedUrls(exercises);

        for (const [index, item] of exercisesWithUrls.entries()) {
            const emojiIndex = toEmojiNumber(index + 1);
            const caption = `${emojiIndex} ${item.name}\n${item.instructions}`;

            await telegramMessagingService.sendMessage(context, caption);
            await telegramMessagingService.sendWithMedia(context, item.signedImages);
        }
    }
}

async function generateSignedUrls(exercises: Exercise[]): Promise<ExerciseWithSignedImages[]> {
    return Promise.all(
        exercises.map(async (exercise) => {
            const signedImages = await Promise.all(
                exercise.images.map(async (key) => {
                    const command = new GetObjectCommand({
                        Bucket: 'ka4-today-exercises',
                        Key: `exercises/${key}`,
                    });
                    return getSignedUrl(s3, command, {expiresIn: 3600});
                })
            );

            return new ExerciseWithSignedImages({
                ...exercise,
                signedImages,
            });
        })
    );
}

function parseSafeJsonExercises(text: string): Exercise[] {
    try {
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']');

        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
            return [];
        }

        const jsonString = text.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonString) as unknown;

        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(isExerciseCandidate)
            .map(
                (item) =>
                    new Exercise({
                        name: item.name.trim(),
                        instructions: item.instructions.trim(),
                        images: item.images.map((image) => image.trim()),
                    })
            );
    } catch {
        throw new OpenAIError(`Corrupted json returned by openai:${text}`);
    }
}

function isExerciseCandidate(item: unknown): item is {name: string; instructions: string; images: string[]} {
    return (
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        'instructions' in item &&
        'images' in item &&
        typeof item.name === 'string' &&
        typeof item.instructions === 'string' &&
        Array.isArray(item.images) &&
        item.images.every((image) => typeof image === 'string')
    );
}

export function toEmojiNumber(value: number): string {
    const base = 0x0030;
    const vs16 = 0xfe0f;
    const keycap = 0x20e3;

    return [...value.toString()]
        .map((digit) => String.fromCodePoint(base + Number(digit), vs16, keycap))
        .join('');
}
