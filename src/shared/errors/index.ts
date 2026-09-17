export class BadRequestError extends Error {
    statusCode = 400;

    constructor(message = 'Bad Request') {
        super(message);
        this.name = 'BadRequestError';
    }
}

export class HttpApiError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message = 'HTTP API error') {
        super(message);
        this.name = 'HttpApiError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class NotFoundError extends Error {
    statusCode = 404;

    constructor(message = 'Not Found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class OpenAIError extends Error {
    statusCode: number;

    constructor(message = 'OpenAI API error', statusCode = 500) {
        super(message);
        this.name = 'OpenAIError';
        this.statusCode = statusCode;
    }
}

export class BedrockResponsesError extends Error {
    constructor(message = 'Bedrock Responses API failure') {
        super(message);
        this.name = 'BedrockResponsesError';
    }
}

export class McpConnectionError extends Error {
    constructor(message = 'MCP connection failure') {
        super(message);
        this.name = 'McpConnectionError';
    }
}

export class McpToolError extends Error {
    constructor(message = 'MCP tool failure') {
        super(message);
        this.name = 'McpToolError';
    }
}

export class RepositorySearchError extends Error {
    constructor(message = 'Exercise repository search failure') {
        super(message);
        this.name = 'RepositorySearchError';
    }
}

export class MalformedAiResponseError extends Error {
    constructor(message = 'Malformed or mismatched structured response') {
        super(message);
        this.name = 'MalformedAiResponseError';
    }
}

export class ExerciseImageSigningError extends Error {
    constructor(message = 'Exercise image signing failure') {
        super(message);
        this.name = 'ExerciseImageSigningError';
    }
}

export class TelegramError extends Error {
    statusCode: number;

    constructor(message = 'Telegram API error', statusCode = 500) {
        super(message);
        this.name = 'TelegramError';
        this.statusCode = statusCode;
    }
}

export function toShortErrorLog(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return {
        error,
    };
}
