import {BaseCommand} from "./BaseCommand.js";
import {EXPECTED_MESSAGE} from "../config/constants.js";
import {telegramService} from "../services/telegramService.js";
import {openAiService} from "../services/openAiService.js";
import {OpenAIError} from "../utils/errors.js";
import {OPENAI_ASSISTANT_ID, OPENAI_DEFAULT_PROMPT} from '../config/env.js';

export class DefaultCommand extends BaseCommand {
    canHandle(text) {
        return text === EXPECTED_MESSAGE;
    }

    async execute(context) {
        const assistantReply = await fetchOpenAiReply()
        await telegramService.sendMessage(context.chatId, assistantReply);
    }
}

/**
 * Runs the OpenAI Assistant on a new thread and extracts the final assistant reply.
 *
 * @returns {Promise<string>} - The extracted assistant reply as plain text.
 * @throws {OpenAIError} If the run did not complete successfully or no reply is found.
 */
async function fetchOpenAiReply() {
    const threadId = await openAiService.createThread();

    await openAiService.addMessageToThread(threadId, OPENAI_DEFAULT_PROMPT);

    const runId = await openAiService.run(OPENAI_ASSISTANT_ID, threadId);

    const completed = await openAiService.waitForRun(threadId, runId);
    if (!completed) {
        throw new OpenAIError(`Run ${runId} did not complete successfully`);
    }

    const messages = await openAiService.getMessages(threadId);
    return openAiService.extractAssistantReply(messages);
}
