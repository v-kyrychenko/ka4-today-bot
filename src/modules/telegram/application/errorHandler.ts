import {
    TG_ERROR_POSTGRES_UNAVAILABLE,
    TG_ERROR_DEFAULT,
} from '../../../app/config/constants.js';
import {isPostgresUnavailableError} from '../../../infrastructure/persistence/postgres/postgresErrors.js';
import {telegramMessagingService} from './telegramMessagingService.js';

export async function errorHandler(chatId: number, error: unknown): Promise<void> {
    const message = isPostgresUnavailableError(error)
        ? TG_ERROR_POSTGRES_UNAVAILABLE
        : TG_ERROR_DEFAULT;

    await telegramMessagingService.sendErrorMessage(chatId, message);
}
