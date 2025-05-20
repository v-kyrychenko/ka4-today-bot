export class BadRequestError extends Error {
    constructor(message = 'Bad Request') {
        super(message);
        this.name = 'BadRequestError';
        this.statusCode = 400;
    }
}

export class OpenAIError extends Error {
    constructor(message = 'OpenAI API error', statusCode = 500) {
        super(message);
        this.name = 'OpenAIError';
        this.statusCode = statusCode;
    }
}

export class TelegramError extends Error {
    constructor(message = 'Telegram API error', statusCode = 500) {
        super(message);
        this.name = 'TelegramError';
        this.statusCode = statusCode;
    }
}

