import {DEFAULT_LANG} from '../../app/config/constants.js';
import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

type LocaleDictionary = typeof en;
type TranslationParams = Record<string, string | number>;

const dictionaries: Record<string, LocaleDictionary> = {en, ru, uk};

export const i18nService = {
    tr,
    normalizeLang,
};

export function tr(lang: string | null | undefined, key: string, params: TranslationParams = {}): string {
    const dictionary = dictionaries[normalizeLang(lang)] ?? en;
    const value = resolveValue(dictionary, key) ?? resolveValue(en, key);
    const template = typeof value === 'string' ? value : key;

    return renderTemplate(template, params);
}

export function normalizeLang(lang: string | null | undefined): string {
    const normalized = (lang || DEFAULT_LANG).trim().toLowerCase();

    if (normalized === 'ua') {
        return 'uk';
    }

    return dictionaries[normalized] ? normalized : 'en';
}

function resolveValue(dictionary: LocaleDictionary, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[part];
    }, dictionary);
}

function renderTemplate(template: string, params: TranslationParams): string {
    return Object.entries(params).reduce((output, [key, value]) => {
        return output.split(`{${key}}`).join(String(value));
    }, template);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
