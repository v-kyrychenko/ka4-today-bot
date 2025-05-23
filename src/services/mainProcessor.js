import {openAiService} from './openAiService.js';
import {telegramService} from './telegramService.js';
import {ensureUserExists} from './userService.js';
import {BadRequestError, OpenAIError} from '../utils/errors.js';
import {EXPECTED_MESSAGE} from "../config/constants.js";
import {OPENAI_ASSISTANT_ID, OPENAI_DEFAULT_PROMPT} from '../config/env.js';
import {log} from "../utils/logger.js";

/**
 * Telegram webhook handler.
 * @param {{ chat?: { id: number }, message?: { text?: string } }} request - object received from Telegram webhook.
 * @returns {Promise<void>}
 * @throws {BadRequestError|OpenAIError}
 */
export const mainProcessor = {
    execute: async (inRequest) => {
        const {chatId, text, userId, username} = extractTelegramContext(inRequest);

        log(`Incoming message from ${username || userId}: ${text}`);
       // await ensureUserExists(inRequest.message)

        if (text !== EXPECTED_MESSAGE) {
            log(`Skipped. Invalid message content: ${text}`);
            return
        }

        try {
            const assistantReply = await fetchOpenAiReply()
            await telegramService.sendMessage(chatId, assistantReply);
        } catch (e) {
            await telegramService.sendMessage(chatId, "🧠💥🪄🐞");
            throw e;
        }
    },
}

/**
 * Runs the OpenAI Assistant on a new thread and extracts the final assistant reply.
 *
 * @returns {Promise<string>} - The extracted assistant reply as plain text.
 * @throws {OpenAIError} If the run did not complete successfully or no reply is found.
 */
export async function fetchOpenAiReply() {
    const threadId = await openAiService.createThread();

    await openAiService.addMessageToThread(threadId, OPENAI_DEFAULT_PROMPT);

    const runId = await openAiService.run(OPENAI_ASSISTANT_ID, threadId);

    const completed = await openAiService.waitForRun(threadId, runId);
    if (!completed) {
        throw new OpenAIError(`Run ${runId} did not complete successfully`);
    }

    const messages = await openAiService.getMessages(threadId);
    return extractAssistantReply(messages);
}

/**
 * @param {{ data: Array<{ role: string, created_at: number, content: any[] }> }} messages
 */
export function extractAssistantReply(messages) {
    if (!Array.isArray(messages?.data)) {
        throw new OpenAIError('Invalid messages format: expected data[] array');
    }

    const assistantMessages = messages.data
        .filter(m => m.role === 'assistant')
        .sort((a, b) => b.created_at - a.created_at);

    if (!assistantMessages.length) {
        throw new OpenAIError('No assistant messages found in thread');
    }

    const last = assistantMessages[0];

    const textPart = last.content.find(part => part.type === 'text');

    if (!textPart || !textPart.text?.value) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return postProcessText(textPart.text);
}

/**
 * Delete all text annotations (example: 4:10†source) from assistant response.
 * @param {{ value: string, annotations?: Array<{ text: string }> }} text
 * @returns {string}
 */
function postProcessText({value, annotations = []}) {
    let result = value;

    for (const annotation of annotations) {
        if (!annotation.text) continue;
        result = result.replaceAll(annotation.text, '');
    }

    return result.trim();
}

/**
 * Extract main fields from Telegram webhook-request.
 *
 * @param {{ message?: { text?: string, chat?: { id?: number }, from?: { id?: number, username?: string } } }} request
 * @returns {{ chatId: number|null, text: string|null, userId: number|null, username: string|null }}
 */
export function extractTelegramContext(request) {
    try {
        const chatId = request?.message?.chat?.id ?? null;
        const text = request?.message?.text ?? null;
        const userId = request?.message?.from?.id ?? null;
        const username = request?.message?.from?.username ?? null;

        return {chatId, text, userId, username};
    } catch {
        return {chatId: null, text: null, userId: null, username: null};
    }
}

