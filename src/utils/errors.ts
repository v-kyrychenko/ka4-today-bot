export class BadRequestError extends Error {
    statusCode = 400;

    constructor(message = 'Bad Request') {
        super(message);
        this.name = 'BadRequestError';
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

export class TelegramError extends Error {
    statusCode: number;

    constructor(message = 'Telegram API error', statusCode = 500) {
        super(message);
        this.name = 'TelegramError';
        this.statusCode = statusCode;
    }
}
