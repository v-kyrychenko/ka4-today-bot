import {TELEGRAM_MINI_APP_INIT_DATA_MAX_LENGTH} from '../../../app/config/constants.js';
import {BadRequestError, HttpApiError} from '../../../shared/errors';
import {
    assertAllowedKeys,
    jsonResponse,
    parseRequiredDate,
    parseRequiredString,
} from '../../../shared/http/apiHelpers.js';
import {parseJsonBody} from '../../../shared/http/requestBody.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../../shared/types/aws.js';
import {toIsoDate} from '../../../shared/utils/dateUtils.js';
import {bodyMeasurementService} from '../features/measurements/bodyMeasurementService.js';
import {miniAppService} from '../features/web/miniAppService.js';
import {
    BODY_MEASUREMENT_TYPES,
    BodyMeasurementType,
    type BodyMeasurementCreateInput,
} from '../features/measurements/bodyMeasurementsModel.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';

const REQUEST_KEYS = ['initData', 'measuredAt', 'measurements'];
const MAX_MEASUREMENT_VALUE = 9999.9;

export async function handleBodyMeasurementsCreate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const request = parseRequest(event);
    const miniAppUser = miniAppService.validate(request.initData);
    const user = await tgUserRepository.findActiveByChatId(miniAppUser.id);

    if (!user) {
        throw new HttpApiError(404, 'TELEGRAM_USER_NOT_FOUND', 'Telegram user was not found');
    }
    if (user.clientId == null) {
        throw new HttpApiError(404, 'TELEGRAM_CLIENT_NOT_LINKED', 'Telegram user is not linked to a client');
    }

    await bodyMeasurementService.store(toCreateInput(user.clientId, request));

    return jsonResponse(201, {ok: true});
}

function parseRequest(event: ApiGatewayHttpEvent) {
    const body = parseRequestBody(event);
    assertAllowedKeys(body, REQUEST_KEYS);

    return {
        initData: parseRequiredString(body, 'initData', TELEGRAM_MINI_APP_INIT_DATA_MAX_LENGTH),
        measuredAt: parseMeasuredAt(body),
        measurements: parseMeasurements(body),
    };
}

function parseRequestBody(event: ApiGatewayHttpEvent): Record<string, unknown> {
    const body = parseJsonBody<unknown>(event);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new BadRequestError('Request body must be a JSON object');
    }

    return body as Record<string, unknown>;
}

function parseMeasuredAt(body: Record<string, unknown>): string {
    const value = parseRequiredDate(body, 'measuredAt');

    if (value > toIsoDate(new Date())) {
        throw new BadRequestError("Field 'measuredAt' must be today or earlier");
    }

    return value;
}

function parseMeasurements(body: Record<string, unknown>) {
    const value = body.measurements;
    if (!Array.isArray(value) || value.length === 0) {
        throw new BadRequestError("Field 'measurements' must be a non-empty array");
    }

    const seenTypes = new Set<BodyMeasurementType>();
    return value.map((item, index) => {
        const measurement = parseMeasurement(item, index);
        if (seenTypes.has(measurement.type)) {
            throw new BadRequestError(`Field 'measurements[${index}].type' must be unique`);
        }

        seenTypes.add(measurement.type);
        return measurement;
    });
}

function parseMeasurement(value: unknown, index: number) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestError(`Field 'measurements[${index}]' must be an object`);
    }

    const item = value as Record<string, unknown>;
    assertAllowedKeys(item, ['type', 'value', 'unit']);

    const type = parseMeasurementType(item, index);
    const unit = parseMeasurementUnit(item, type, index);

    return {
        type,
        unit,
        value: parseMeasurementValue(item, index),
    };
}

function parseMeasurementType(item: Record<string, unknown>, index: number): BodyMeasurementType {
    const value = item.type;

    if (typeof value !== 'string' || !BODY_MEASUREMENT_TYPES.includes(value as BodyMeasurementType)) {
        throw new BadRequestError(
            `Field 'measurements[${index}].type' must be one of: ${BODY_MEASUREMENT_TYPES.join(', ')}`
        );
    }

    return value as BodyMeasurementType;
}

function parseMeasurementUnit(
    item: Record<string, unknown>,
    type: BodyMeasurementType,
    index: number
): string {
    const value = item.unit;
    const expected = getExpectedUnit(type);

    if (value !== expected) {
        throw new BadRequestError(`Field 'measurements[${index}].unit' must be '${expected}'`);
    }

    return expected;
}

function parseMeasurementValue(item: Record<string, unknown>, index: number): number {
    const value = item.value;

    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_MEASUREMENT_VALUE) {
        throw new BadRequestError(
            `Field 'measurements[${index}].value' must be a positive number up to ${MAX_MEASUREMENT_VALUE}`
        );
    }
    if (!hasSingleDecimalPlace(value)) {
        throw new BadRequestError(`Field 'measurements[${index}].value' must have at most 1 decimal place`);
    }

    return value;
}

function hasSingleDecimalPlace(value: number): boolean {
    return Math.abs(value * 10 - Math.round(value * 10)) < Number.EPSILON * 10;
}

function getExpectedUnit(type: BodyMeasurementType): string {
    return type === BodyMeasurementType.WEIGHT ? 'kg' : 'cm';
}

function toCreateInput(clientId: number, request: ReturnType<typeof parseRequest>): BodyMeasurementCreateInput[] {
    return request.measurements.map((measurement) => ({
        clientId,
        createdAt: request.measuredAt,
        amount: measurement.value,
        type: measurement.type,
        unitKey: measurement.unit,
    }));
}
