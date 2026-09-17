import {DEFAULT_LANG} from '../../../../app/config/constants.js';
import {BadRequestError} from '../../../../shared/errors';
import {dictPromptRepository} from '../../repository/dictPromptRepository.js';
import type {PromptDict} from './prompt.js';

type TemplateVariableValue = unknown;

export interface ResolvePromptTemplateRequest {
    lang?: string | null;
    promptRef: string;
    variables?: Record<string, TemplateVariableValue>;
}

export interface ResolvedPromptTemplate {
    prompt: PromptDict;
    systemPrompt: string;
    userPrompt: string;
}

export const promptTemplateService = {
    resolve,
};

export async function resolve(request: ResolvePromptTemplateRequest): Promise<ResolvedPromptTemplate> {
    const lang = normalizeLang(request.lang);
    const prompt = await dictPromptRepository.getPromptByKey(request.promptRef);
    const systemPromptDict = prompt.systemPrompt;

    if (!systemPromptDict) {
        throw new BadRequestError(`Prompt '${prompt.key}' has no systemPromptRef configuration`);
    }

    const systemTemplate = systemPromptDict.prompts[lang];
    const userTemplate = prompt.prompts[lang];
    if (systemTemplate == null) {
        throw new BadRequestError(`Prompt '${systemPromptDict.key}' has no translation for language '${lang}'.`);
    }
    if (userTemplate == null) {
        throw new BadRequestError(`Prompt '${prompt.key}' has no translation for language '${lang}'.`);
    }

    return {
        prompt,
        systemPrompt: renderPromptTemplate(systemTemplate, request.variables),
        userPrompt: renderPromptTemplate(userTemplate, request.variables),
    };
}

function renderPromptTemplate(template: string, variables: Record<string, TemplateVariableValue> = {}): string {
    return Object.entries(variables).reduce((output, [key, value]) => {
        return output.split(`\${${key}}`).join(formatValue(value));
    }, template);
}

function formatValue(value: TemplateVariableValue): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
    if (isPlainObject(value)) {
        return Object.entries(value).map(([key, nested]) => `${key}: ${formatNested(nested)}`).join(', ');
    }
    if (typeof value === 'object') return JSON.stringify(value);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
}

function formatNested(value: unknown): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLang(lang: string | null | undefined): string {
    const normalized = (lang || DEFAULT_LANG).trim().toLowerCase();
    return normalized === 'uk' ? 'ua' : normalized;
}
