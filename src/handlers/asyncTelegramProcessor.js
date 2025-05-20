import { webhookProcessor } from '../services/webhookProcessor.js';
import { logError } from '../utils/logger.js';

/**
 * Entry point for async Lambda processing.
 * Receives a wrapped request forwarded from webhookReceiver.
 */
export const handler = async (event) => {
    try {
        const body = extractBody(event.request);
        await webhookProcessor.execute(body);
        return buildResponse(200, 'OK');
    } catch (err) {
        logError('webhook execution failed', err);
        const status = err.statusCode || 500;
        const message = err.message || 'Internal Server Error';
        return buildResponse(status, message);
    }
};

/**
 * Extracts and parses the body from an event or sub-object.
 * - If input is already an object → returns as-is.
 * - If it's a stringified JSON → parses it.
 * - If invalid or missing → throws error.
 *
 * @param {string|object|null|undefined} input
 * @returns {object}
 * @throws {Error} if body is invalid or unparseable
 */
export function extractBody(input) {
    if (!input) {
        throw new Error('Missing request body');
    }

    if (typeof input === 'object') {
        return input;
    }

    if (typeof input === 'string') {
        try {
            return JSON.parse(input);
        } catch {
            throw new Error('Invalid JSON in body string');
        }
    }

    throw new Error('Unsupported body format');
}

function buildResponse(statusCode, message) {
    return {
        statusCode,
        body: JSON.stringify({message}),
    };
}
