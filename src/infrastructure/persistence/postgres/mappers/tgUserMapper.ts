import {DEFAULT_LANG} from '../../../../app/config/constants.js';
import {TelegramUserAccount, TelegramUserProfile} from '../../../../modules/telegram/model/telegram.js';
import type {TgUserRow} from '../models/tgUserRow.js';

export interface TgUserCreateRow {
    chat_id: number;
    client_id: null;
    username: string;
    phone: null;
    lang: string;
    is_active: boolean;
    is_bot: boolean;
}

export const tgUserMapper = {
    toAppModel,
    toCreateRow,
};

export function toAppModel(row: TgUserRow): TelegramUserAccount {
    return new TelegramUserAccount({
        chatId: row.chat_id,
        clientId: row.client_id,
        username: row.username,
        phone: row.phone,
        lang: row.lang,
        isActive: row.is_active,
        isBot: row.is_bot,
    });
}

export function toCreateRow(chatId: number, profile?: TelegramUserProfile): TgUserCreateRow {
    return {
        chat_id: chatId,
        client_id: null,
        username: normalizeUsername(chatId, profile?.username),
        phone: null,
        lang: normalizeLang(profile?.language_code),
        is_active: true,
        is_bot: Boolean(profile?.is_bot),
    };
}

function normalizeUsername(chatId: number, username?: string): string {
    const normalized = username?.trim();
    return normalized || `chat_${chatId}`;
}

function normalizeLang(lang?: string): string {
    const normalized = lang?.trim();
    return normalized || DEFAULT_LANG;
}
