import {BaseCommand} from "./BaseCommand.js";
import {DAILY_WORKOUT_COMMAND} from "./registry.js";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {openAiService} from "../services/openAiService.js";
import {telegramService} from "../services/telegramService.js";
import {OpenAIError} from "../utils/errors.js";
import {dynamoDbService} from "../services/dynamoDbService.js";
import {log} from "../utils/logger.js";

const s3 = new S3Client();

const PROMPT_REF = "daily_workout";
const PROMPT_REF_NOT_TODAY = "no_training_for_today";
const PROMPT_REF_NOT_NO_PLAN = "no_plan_for_training";

export class DailyWorkoutCommand extends BaseCommand {

    canHandle(text) {
        return text === DAILY_WORKOUT_COMMAND;
    }

    async execute(context) {
        const chatId = context.chatId

        const scheduled = await dynamoDbService.getUserScheduledForDay(context.chatId);
        log(`🕐 ChatId:${chatId}, found scheduled training for today:${JSON.stringify(scheduled)}`);
        if (!scheduled) {
            const replay = await openAiService.fetchOpenAiReply({
                context, promptRef: PROMPT_REF_NOT_TODAY,
            });
            await telegramService.sendMessage(context, replay);
            return;
        }

        const plan = scheduled.plan;
        if (plan == null) {
            const msg = await openAiService.fetchOpenAiReply({
                context, promptRef: PROMPT_REF_NOT_NO_PLAN,
            });
            await telegramService.sendMessage(context, msg);
            return;
        }

        const replay = await openAiService.fetchOpenAiReply({
            context,
            promptRef: PROMPT_REF,
            variables: {plan}
        })

        const exercises = parseSafeJsonExercises(replay)
        const exercisesWithUrls = await generateSignedUrls(exercises);

        for (const [index, item] of exercisesWithUrls.entries()) {
            const emojiIndex = toEmojiNumber(index + 1);
            const caption = `${emojiIndex} ${item.name}\n${item.instructions}`;

            await telegramService.sendMessage(context, caption);
            await telegramService.sendWithMedia(context, item.signedImages);
        }
    }
}

/**
 * Generates signed S3 URLs for exercise images.
 *
 * @async
 * @function generateSignedUrls
 * @param {Array<Object>} exercises - An array of exercise objects.
 * @param {string} exercises[].name - The name of the exercise.
 * @param {string} exercises[].instructions - Description or steps for the exercise.
 * @param {string[]} exercises[].images - Array of relative image paths (e.g., "Incline_Dumbbell_Flyes/0.jpg").
 * @returns {Promise<Array<Object>>} A new array of exercises with an additional `signedImages` field,
 * each containing an array of signed S3 URLs for secure access.
 *
 * @example
 * const signed = await generateSignedUrls(exercises);
 * console.log(signed[0].signedImages); // ['https://s3.../exercises/Incline_Dumbbell_Flyes/0.jpg?...']
 */
async function generateSignedUrls(exercises) {
    return await Promise.all(
        exercises.map(async (ex) => {
            const signedImages = await Promise.all(
                ex.images.map(async (key) => {
                    const command = new GetObjectCommand({
                        Bucket: "ka4-today-exercises",
                        Key: `exercises/${key}`,
                    });
                    return await getSignedUrl(s3, command, {expiresIn: 3600});
                })
            );

            return {
                ...ex,
                signedImages,
            };
        })
    );
}

/**
 * Safely parses a JSON-like string and extracts an array of valid exercise objects.
 * It ignores invalid entries and ensures only well-structured items are returned.
 *
 * Each valid exercise must contain:
 * - name: string
 * - instructions: string
 * - images: string[] (array of image paths)
 *
 * This function is useful for parsing responses from language models or user-generated content,
 * where the JSON might be surrounded by additional text or contain partially malformed objects.
 *
 * @param {string} text - Raw input text containing a JSON array or JSON-like structure.
 * @returns {Array<{ name: string, instructions: string, images: string[] }>} Array of validated exercise objects.
 *
 * @example
 * const input = `
 * [
 *   {
 *     "name": "Incline Dumbbell Flyes",
 *     "instructions": "Lie back on an incline bench...",
 *     "images": [
 *       "Incline_Dumbbell_Flyes/0.jpg",
 *       "Incline_Dumbbell_Flyes/1.jpg"
 *     ]
 *   }
 * ]
 * `;
 *
 * const exercises = parseSafeJsonExercises(input);
 * console.log(exercises[0].name); // "Incline Dumbbell Flyes"
 */
function parseSafeJsonExercises(text) {
    try {
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']');

        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
            return [];
        }

        const jsonString = text.slice(jsonStart, jsonEnd + 1);

        const parsed = JSON.parse(jsonString);

        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(
                (item) =>
                    typeof item === 'object' &&
                    typeof item.name === 'string' &&
                    typeof item.instructions === 'string' &&
                    Array.isArray(item.images) &&
                    item.images.every((img) => typeof img === 'string')
            )
            .map((item) => ({
                name: item.name.trim(),
                instructions: item.instructions.trim(),
                images: item.images.map((img) => img.trim()),
            }));
    } catch (e) {
        throw new OpenAIError(`Corrupted json returned by openai:${text}`)
    }
}

export function toEmojiNumber(n) {
    const base = 0x0030; // "0"
    const vs16 = 0xfe0f; // variation selector
    const keycap = 0x20e3;

    return [...n.toString()].map(d =>
        String.fromCodePoint(base + +d, vs16, keycap)
    ).join('');
}