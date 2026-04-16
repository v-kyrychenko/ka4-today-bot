import {
    PAGINATION_DEFAULT_LIMIT, PAGINATION_DEFAULT_PAGE, PAGINATION_MAX_LIMIT,
} from '../../config/constants.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../models/aws.js';
import {exerciseService} from '../../services/exerciseService.js';
import {BadRequestError} from '../../utils/errors.js';
import {getQueryParam, jsonResponse, parseOptionalInteger} from '../../utils/api.js';

export async function handleExerciseGet(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const q = getRequiredQuery(event, 'q').trim();
    if (!q) {
        throw new BadRequestError("Query param 'q' is required");
    }

    const page = parseOptionalInteger(getQueryParam(event, 'page'), {
        defaultValue: PAGINATION_DEFAULT_PAGE,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        name: 'page',
    });
    const limit = parseOptionalInteger(getQueryParam(event, 'limit'), {
        defaultValue: PAGINATION_DEFAULT_LIMIT,
        min: 1,
        max: PAGINATION_MAX_LIMIT,
        name: 'limit',
    });

    const result = await exerciseService.searchExercises({
        q,
        page,
        limit,
    });

    return jsonResponse(200, {
        items: result.items,
        pagination: {
            page,
            limit,
            total: result.total,
        },
    });
}

function getRequiredQuery(event: ApiGatewayHttpEvent, name: string): string {
    const value = getQueryParam(event, name);
    if (value === undefined) {
        throw new BadRequestError(`Query param '${name}' is required`);
    }

    return value;
}
