import {
    telegramClient,
    type TelegramBotCommand,
    type TelegramBotCommandScope,
} from '../../../../infrastructure/integrations/telegram/telegramClient.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {logError} from '../../../../shared/logging';
import type {TelegramUserAccount} from '../../model/telegram.js';
import {WORKOUT_LOGGING_END_ROUTE, WORKOUT_LOGGING_START_ROUTE} from '../../routes/constants.js';

const DEFAULT_SCOPE: TelegramBotCommandScope = {type: 'default'};

export const workoutCommandMenuService = {
    restoreDefaultMenu,
    showWorkoutActiveMenu,
};

export async function showWorkoutActiveMenu(user: Pick<TelegramUserAccount, 'chatId' | 'lang'>): Promise<void> {
    try {
        const commands = await getDefaultCommands(user.lang);
        const description = i18nService.tr(user.lang, I18N_KEYS.telegram.commands.workoutLogging.end);
        const activeCommands = replaceWorkoutCommand(commands, description);
        await telegramClient.setMyCommands(activeCommands, chatScope(user.chatId));
    } catch (error) {
        logError(`Failed to show active workout commands for chat ${user.chatId}`, error);
    }
}

export async function restoreDefaultMenu(chatId: number): Promise<void> {
    try {
        await telegramClient.deleteMyCommands(chatScope(chatId));
    } catch (error) {
        logError(`Failed to restore default commands for chat ${chatId}`, error);
    }
}

async function getDefaultCommands(lang: string | null | undefined): Promise<TelegramBotCommand[]> {
    const localized = await telegramClient.getMyCommands(DEFAULT_SCOPE, i18nService.normalizeLang(lang));
    return localized.length ? localized : telegramClient.getMyCommands(DEFAULT_SCOPE);
}

function replaceWorkoutCommand(commands: TelegramBotCommand[], description: string): TelegramBotCommand[] {
    const startCommand = commandName(WORKOUT_LOGGING_START_ROUTE);
    const endCommand = commandName(WORKOUT_LOGGING_END_ROUTE);
    const result: TelegramBotCommand[] = [];
    let workoutCommandAdded = false;

    for (const command of commands) {
        if (command.command !== startCommand && command.command !== endCommand) {
            result.push(command);
            continue;
        }

        if (!workoutCommandAdded) {
            result.push({command: endCommand, description});
            workoutCommandAdded = true;
        }
    }

    if (!workoutCommandAdded) {
        result.push({command: endCommand, description});
    }

    return result;
}

function chatScope(chatId: number): TelegramBotCommandScope {
    return {type: 'chat', chat_id: chatId};
}

function commandName(route: string): string {
    return route.startsWith('/') ? route.slice(1) : route;
}
