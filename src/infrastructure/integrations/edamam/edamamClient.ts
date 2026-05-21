import {EDAMAM_API_ID, EDAMAM_API_KEY, EDAMAM_API_USER} from '../../../app/config/env.js';
import {EdamamError} from '../../../shared/errors';
import {httpRequest} from '../../../shared/http/httpClient.js';
import type {
    EdamamMealPlannerSelectRequest,
    EdamamMealPlannerSelectResponse,
    EdamamRecipeResponse
} from './types.js';

const EDAMAM_API_LABEL = 'EDAMAM';
const EDAMAM_BASE_URL = 'https://api.edamam.com';
const EDAMAM_API_HEADERS: Record<string, string> = {
    Authorization: `Basic ${btoa(`${EDAMAM_API_ID}:${EDAMAM_API_KEY}`)}`,
    'Content-Type': 'application/json',
    'Edamam-Account-User': EDAMAM_API_USER ?? '',
};

export const edamamClient = {
    selectMealPlan,
    getRecipe,
};

export async function selectMealPlan(
    request: EdamamMealPlannerSelectRequest
): Promise<EdamamMealPlannerSelectResponse> {
    return await httpRequest<EdamamMealPlannerSelectResponse, EdamamMealPlannerSelectRequest>({
        method: 'POST',
        path: `/api/meal-planner/v1/${EDAMAM_API_ID}/select?type=public`,
        endpointUrl: EDAMAM_BASE_URL,
        headers: EDAMAM_API_HEADERS,
        body: request,
        label: `${EDAMAM_API_LABEL}:meal-planner-select`,
        errorClass: EdamamError,
    });
}

export async function getRecipe(recipeId: string): Promise<EdamamRecipeResponse> {
    return await httpRequest<EdamamRecipeResponse>({
        method: 'GET',
        path: `/api/recipes/v2/${recipeId}`,
        endpointUrl: EDAMAM_BASE_URL,
        headers: EDAMAM_API_HEADERS,
        label: `${EDAMAM_API_LABEL}:recipe-details`,
        errorClass: EdamamError,
    });
}
