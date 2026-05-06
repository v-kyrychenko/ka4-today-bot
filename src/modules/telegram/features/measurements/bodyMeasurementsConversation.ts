import {HttpApiError} from '../../../../shared/errors';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {log} from '../../../../shared/logging';
import {toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {tgConversationStateRepository} from '../../repository/tgConversationStateRepository.js';
import {
    CONVERSATION_STEP_CANCELLED,
    CONVERSATION_STEP_COMPLETED,
    type ConversationCallbackContext,
    type ConversationDefinition,
    type ConversationResponse,
    type ConversationTextContext,
} from '../conversations/model.js';
import {localizedButton, localizedResponse} from '../conversations/conversationResponses.js';
import {promptReplyService} from '../prompts/promptReplyService.js';
import {bodyMeasurementService} from './bodyMeasurementService.js';
import {
    BODY_MEASUREMENT_METRIC_I18N_KEYS,
    type BodyMeasurementCreateInput,
    BodyMeasurementType,
    CONVERSATION_TYPE_BODY_MEASUREMENTS,
} from './bodyMeasurementsModel.js';
import {
    getStoredMeasurements,
    type MeasurementDraft,
    mergeMeasurements,
    parseMeasurementsReply,
} from './bodyMeasurementsParser.js';

const MEASUREMENT_PARSER_PROMPT_REF = 'measurement_parser';
const CONVERSATION_STEP_WAITING_INPUT = 'WAITING_INPUT';
const CONVERSATION_STEP_WAITING_CONFIRMATION = 'WAITING_CONFIRMATION';
const SAVE_CALLBACK = 'MEASUREMENTS:SAVE';
const EDIT_CALLBACK = 'MEASUREMENTS:EDIT';
const CANCEL_CALLBACK = 'MEASUREMENTS:CANCEL';
const BODY_MEASUREMENT_TOO_SOON = 'BODY_MEASUREMENT_TOO_SOON';

export const bodyMeasurementsConversation: ConversationDefinition = {
    type: CONVERSATION_TYPE_BODY_MEASUREMENTS,
    initialStep: CONVERSATION_STEP_WAITING_INPUT,
    ttlMinutes: 30 * 2 * 12, // 12 hours
    steps: {
        [CONVERSATION_STEP_WAITING_INPUT]: {
            onText: (context) =>
                handleMeasurementInput(context, []),
        },
        [CONVERSATION_STEP_WAITING_CONFIRMATION]: {
            onCallback: handleConfirmationCallback,
        },
    },
    getInitialMessage: (user) => localizedResponse(
        user.lang,
        I18N_KEYS.telegram.conversations.bodyMeasurements.initialMessage,
    ),
};

async function handleMeasurementInput(context: ConversationTextContext, existingMeasurements: MeasurementDraft[]): Promise<ConversationResponse> {
    const parsed = await parseMeasurementsFromText(context.text, context.user.lang);

    if (!parsed.length) {
        return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.invalidInput);
    }

    const merged = mergeMeasurements(existingMeasurements, parsed);

    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        currentStep: CONVERSATION_STEP_WAITING_CONFIRMATION,
        data: {measurements: merged},
    });

    return buildConfirmationResponse(context.user.lang, merged);
}

async function handleConfirmationCallback(context: ConversationCallbackContext): Promise<ConversationResponse> {
    if (context.callbackData === SAVE_CALLBACK) {
        return saveMeasurementsSafely(context);
    }
    if (context.callbackData === EDIT_CALLBACK) {
        return requestMeasurementsEdit(context);
    }
    if (context.callbackData === CANCEL_CALLBACK) {
        return cancelMeasurements(context);
    }

    return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.unsupportedAction);
}

async function saveMeasurementsSafely(context: ConversationCallbackContext): Promise<ConversationResponse> {
    try {
        return await saveMeasurements(context);
    } catch (error) {
        if (error instanceof HttpApiError && error.code === BODY_MEASUREMENT_TOO_SOON) {
            await tgConversationStateRepository.deactivateConversation({
                id: context.state.id,
                finalStep: CONVERSATION_STEP_CANCELLED,
            });
            log('### CONVERSATION:cancel_too_soon', {chatId: context.user.chatId, type: context.state.type});

            return withReplyMarkupRemoval(
                localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.tooSoon)
            );
        }

        throw error;
    }
}

async function saveMeasurements(context: ConversationCallbackContext): Promise<ConversationResponse> {
    if (context.user.clientId == null) {
        return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.invalidInput);
    }

    await bodyMeasurementService.store(toCreateInput(context.user.clientId, context.state.data));
    await tgConversationStateRepository.deactivateConversation({
        id: context.state.id,
        finalStep: CONVERSATION_STEP_COMPLETED,
    });
    log('### CONVERSATION:complete', {chatId: context.user.chatId, type: context.state.type});

    return withReplyMarkupRemoval(
        localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.saveSuccess)
    );
}

async function requestMeasurementsEdit(context: ConversationCallbackContext): Promise<ConversationResponse> {
    await tgConversationStateRepository.updateConversation({
        id: context.state.id,
        currentStep: CONVERSATION_STEP_WAITING_INPUT,
        data: context.state.data,
    });

    return localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.editPrompt);
}

async function cancelMeasurements(context: ConversationCallbackContext): Promise<ConversationResponse> {
    await tgConversationStateRepository.deactivateConversation({
        id: context.state.id,
        finalStep: CONVERSATION_STEP_CANCELLED,
    });
    log('### CONVERSATION:cancel', {chatId: context.user.chatId, type: context.state.type});

    return withReplyMarkupRemoval(
        localizedResponse(context.user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.cancel)
    );
}

async function parseMeasurementsFromText(text: string, lang: string | null | undefined): Promise<MeasurementDraft[]> {
    const reply = await promptReplyService.fetchOpenAiReply({
        lang,
        promptRef: MEASUREMENT_PARSER_PROMPT_REF,
        variables: {USER_INPUT: text},
    });

    return parseMeasurementsReply(reply);
}

function buildConfirmationResponse(lang: string | null | undefined, measurements: MeasurementDraft[]): ConversationResponse {
    return {
        text: i18nService.tr(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.confirmation, {
            measurements: formatMeasurements(lang, measurements),
        }),
        replyMarkup: {
            inline_keyboard: [[
                localizedButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonSave, SAVE_CALLBACK),
                localizedButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonEdit, EDIT_CALLBACK),
                localizedButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonCancel, CANCEL_CALLBACK),
            ]],
        },
    };
}

function withReplyMarkupRemoval(response: ConversationResponse): ConversationResponse {
    return {...response, removeReplyMarkup: true};
}

function toCreateInput(clientId: number, data: unknown): BodyMeasurementCreateInput[] {
    const createdAt = toIsoDate(new Date());

    return getStoredMeasurements(data).map((measurement) => ({
        clientId,
        createdAt,
        amount: measurement.value,
        type: measurement.type,
        unitKey: measurement.unit,
    }));
}

function formatMeasurements(lang: string | null | undefined, measurements: MeasurementDraft[]): string {
    return measurements
        .map((item) => `${formatType(lang, item.type)}: ${formatAmount(item.value)} ${item.unit}`)
        .join('\n');
}

function formatTypeList(lang: string | null | undefined, types: BodyMeasurementType[]): string {
    return types.map((type) => formatType(lang, type)).join(', ');
}

function formatType(lang: string | null | undefined, type: BodyMeasurementType): string {
    return i18nService.tr(lang, BODY_MEASUREMENT_METRIC_I18N_KEYS[type]);
}

function formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
