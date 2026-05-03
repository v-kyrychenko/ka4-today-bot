import {i18nService} from '../../../../shared/i18n/i18nService.js';
import type {ConversationResponse} from './model.js';

export function localizedResponse(
    lang: string | null | undefined,
    key: string,
    params: Record<string, string | number> = {},
): ConversationResponse {
    return {text: i18nService.tr(lang, key, params)};
}

export function localizedButton(lang: string | null | undefined, key: string, callbackData: string) {
    return {
        text: i18nService.tr(lang, key),
        callback_data: callbackData,
    };
}
