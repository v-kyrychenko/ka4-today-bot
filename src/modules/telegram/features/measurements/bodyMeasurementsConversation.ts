import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {log} from '../../../../shared/logging';
import {toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {tgConversationStateRepository} from '../../repository/tgConversationStateRepository.js';
import {tgUserRepository} from '../../repository/tgUserRepository.js';
import {ProcessorContext} from '../../model/context.js';
import * as conversations from '../conversations/model.js';
import {promptReplyService} from '../prompts/promptReplyService.js';
import {bodyMeasurementService} from './bodyMeasurementService.js';
import {
    CONVERSATION_TYPE_BODY_MEASUREMENTS,
    BodyMeasurementType,
    type BodyMeasurementCreateInput,
} from './bodyMeasurementsModel.js';
import {
    getMissingTypes,
    getStoredMeasurements,
    mergeMeasurements,
    parseMeasurementsReply,
    type MeasurementDraft,
} from './bodyMeasurementsParser.js';

const MEASUREMENT_PARSER_PROMPT_REF = 'measurement_parser';
const SAVE_CALLBACK = 'MEASUREMENTS:SAVE';
const EDIT_CALLBACK = 'MEASUREMENTS:EDIT';
const CANCEL_CALLBACK = 'MEASUREMENTS:CANCEL';

export const bodyMeasurementsConversation: conversations.ConversationDefinition = {
    type: CONVERSATION_TYPE_BODY_MEASUREMENTS,
    initialStep: conversations.CONVERSATION_STEP_WAITING_INPUT,
    ttlMinutes: 30,
    steps: {
        [conversations.CONVERSATION_STEP_WAITING_INPUT]: {
            onText: (context) =>
                handleMeasurementInput(context, []),
        },
        [conversations.CONVERSATION_STEP_WAITING_MISSING_FIELDS]: {
            onText: (context) =>
                handleMeasurementInput(context, getStoredMeasurements(context.state.data)),
        },
        [conversations.CONVERSATION_STEP_WAITING_CONFIRMATION]: {
            onCallback: handleConfirmationCallback,
        },
    },
    getInitialMessage: () => localizedResponse(
        null,
        I18N_KEYS.telegram.conversations.bodyMeasurements.initialMessage,
    ),
};

async function handleMeasurementInput(
    {chatId, text, state}: conversations.ConversationTextContext,
    existingMeasurements: MeasurementDraft[],
): Promise<conversations.ConversationResponse> {
    const user = await tgUserRepository.findActiveByChatId(chatId);
    const promptContext = new ProcessorContext({chatId, text, user: user ?? undefined});
    const parsed = await parseMeasurementsFromText(text, promptContext);

    if (!parsed.length) {
        return localizedResponse(user?.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.invalidInput);
    }

    const merged = mergeMeasurements(existingMeasurements, parsed);
    const missingTypes = getMissingTypes(merged);
    const nextStep = missingTypes.length
        ? conversations.CONVERSATION_STEP_WAITING_MISSING_FIELDS
        : conversations.CONVERSATION_STEP_WAITING_CONFIRMATION;

    await tgConversationStateRepository.updateConversation({
        id: state.id,
        currentStep: nextStep,
        data: {measurements: merged},
    });

    if (missingTypes.length) {
        return localizedResponse(user?.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.missingFields, {
            fields: formatTypeList(user?.lang, missingTypes),
        });
    }

    return buildConfirmationResponse(user?.lang, merged);
}

async function handleConfirmationCallback(
    context: conversations.ConversationCallbackContext,
): Promise<conversations.ConversationResponse> {
    if (context.callbackData === SAVE_CALLBACK) {
        return saveMeasurements(context);
    }
    if (context.callbackData === EDIT_CALLBACK) {
        return requestMeasurementsEdit(context);
    }
    if (context.callbackData === CANCEL_CALLBACK) {
        return cancelMeasurements(context);
    }

    return localizedResponse(null, I18N_KEYS.telegram.conversations.unsupportedAction);
}

async function saveMeasurements(
    {chatId, state}: conversations.ConversationCallbackContext,
): Promise<conversations.ConversationResponse> {
    const user = await tgUserRepository.findActiveByChatId(chatId);
    if (user?.clientId == null) {
        return localizedResponse(user?.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.invalidInput);
    }

    await bodyMeasurementService.store(toCreateInput(user.clientId, state.data));
    await tgConversationStateRepository.deactivateConversation({
        id: state.id,
        finalStep: conversations.CONVERSATION_STEP_COMPLETED,
    });
    log('### CONVERSATION:complete', {chatId, type: state.type});

    return localizedResponse(user.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.saveSuccess);
}

async function requestMeasurementsEdit(
    {chatId, state}: conversations.ConversationCallbackContext,
): Promise<conversations.ConversationResponse> {
    const user = await tgUserRepository.findActiveByChatId(chatId);
    await tgConversationStateRepository.updateConversation({
        id: state.id,
        currentStep: conversations.CONVERSATION_STEP_WAITING_INPUT,
        data: state.data,
    });

    return localizedResponse(user?.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.editPrompt);
}

async function cancelMeasurements(
    {chatId, state}: conversations.ConversationCallbackContext,
): Promise<conversations.ConversationResponse> {
    const user = await tgUserRepository.findActiveByChatId(chatId);
    await tgConversationStateRepository.deactivateConversation({
        id: state.id,
        finalStep: conversations.CONVERSATION_STEP_CANCELLED,
    });
    log('### CONVERSATION:cancel', {chatId, type: state.type});

    return localizedResponse(user?.lang, I18N_KEYS.telegram.conversations.bodyMeasurements.cancel);
}

async function parseMeasurementsFromText(text: string, context: ProcessorContext): Promise<MeasurementDraft[]> {
    const reply = await promptReplyService.fetchOpenAiReply({
        context,
        promptRef: MEASUREMENT_PARSER_PROMPT_REF,
        variables: {USER_INPUT: text},
    });

    return parseMeasurementsReply(reply);
}

function buildConfirmationResponse(
    lang: string | null | undefined,
    measurements: MeasurementDraft[],
): conversations.ConversationResponse {
    return {
        text: i18nService.tr(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.confirmation, {
            measurements: formatMeasurements(lang, measurements),
        }),
        replyMarkup: {
            inline_keyboard: [[
                buildButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonSave, SAVE_CALLBACK),
                buildButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonEdit, EDIT_CALLBACK),
                buildButton(lang, I18N_KEYS.telegram.conversations.bodyMeasurements.buttonCancel, CANCEL_CALLBACK),
            ]],
        },
    };
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
    return i18nService.tr(lang, getMetricKey(type));
}

function getMetricKey(type: BodyMeasurementType): string {
    const keys = I18N_KEYS.telegram.progress.metric;
    return {
        [BodyMeasurementType.WEIGHT]: keys.weight,
        [BodyMeasurementType.WAIST]: keys.waist,
        [BodyMeasurementType.CHEST]: keys.chest,
        [BodyMeasurementType.HIPS]: keys.hips,
        [BodyMeasurementType.THIGH]: keys.thigh,
        [BodyMeasurementType.CALF]: keys.calf,
        [BodyMeasurementType.BICEPS]: keys.biceps,
    }[type];
}

function localizedResponse(
    lang: string | null | undefined,
    key: string,
    params: Record<string, string | number> = {},
): conversations.ConversationResponse {
    return {text: i18nService.tr(lang, key, params)};
}

function buildButton(lang: string | null | undefined, key: string, callbackData: string) {
    return {
        text: i18nService.tr(lang, key),
        callback_data: callbackData,
    };
}

function formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
