import {createHmac, timingSafeEqual} from 'node:crypto';
import {TELEGRAM_BOT_TOKEN} from '../../../../app/config/env.js';
import {HttpApiError} from '../../../../shared/errors';
import {log} from '../../../../shared/logging';
import {TelegramUserProfile} from '../../domain/telegram.js';

const TELEGRAM_WEB_APP_DATA_PUBLIC_KEY = 'WebAppData';
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

export const miniAppService = {
    validate,
};

export function validate(initData: string): TelegramUserProfile {
    if (!initData.trim()) {
        throwInvalidInitData('Telegram Mini App initData is required');
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash) {
        throwInvalidInitData('Telegram Mini App initData hash is required');
    }

    params.delete('hash');
    assertValidHash(params, receivedHash);

    const authDate = parseAuthDate(params.get('auth_date'));
    assertFreshAuthDate(authDate);

    return parseUser(params.get('user'));
}

function assertValidHash(params: URLSearchParams, receivedHash: string): void {
    const dataCheckString = Array.from(params.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secretKey = createHmac('sha256', TELEGRAM_WEB_APP_DATA_PUBLIC_KEY)
        .update(TELEGRAM_BOT_TOKEN ?? '')
        .digest();
    const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (!isEqualHash(calculatedHash, receivedHash)) {
        throwInvalidInitData('Telegram Mini App initData hash is invalid');
    }
}

function isEqualHash(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseAuthDate(value: string | null): number {
    const authDate = Number(value);

    if (!Number.isInteger(authDate) || authDate <= 0) {
        throwInvalidInitData('Telegram Mini App initData auth_date is invalid');
    }

    return authDate;
}

function assertFreshAuthDate(authDate: number): void {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;

    if (ageSeconds < 0 || ageSeconds > MAX_INIT_DATA_AGE_SECONDS) {
        throwInvalidInitData('Telegram Mini App initData is expired');
    }
}

function parseUser(value: string | null): TelegramUserProfile {
    if (!value) {
        throwInvalidInitData('Telegram Mini App initData user is required');
    }

    try {
        const parsed = JSON.parse(value) as Partial<TelegramUserProfile>;
        const userId = parsed.id;
        if (!Number.isInteger(userId) || userId == null || userId <= 0) {
            throwInvalidInitData('Telegram Mini App initData user.id is invalid');
        }

        return new TelegramUserProfile(parsed);
    } catch (error) {
        if (error instanceof HttpApiError) {
            throw error;
        }

        throwInvalidInitData('Telegram Mini App initData user is invalid');
    }
}

function throwInvalidInitData(message: string): never {
    log('[telegram.miniapp] Invalid initData', {reason: message});
    throw new HttpApiError(401, 'TELEGRAM_INIT_DATA_INVALID', 'Invalid Telegram Mini App initData');
}
