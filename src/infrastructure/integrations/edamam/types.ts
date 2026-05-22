export type EdamamNutrientCode = 'ENERC_KCAL' | 'PROCNT' | 'FAT' | 'CHOCDF' | string;

export interface EdamamNutrientRange {
    min: number;
    max: number;
}

export type EdamamNutrientFit = Record<EdamamNutrientCode, EdamamNutrientRange>;

export interface EdamamMealPlannerSectionRequest {
    fit: EdamamNutrientFit;
    accept?: EdamamMealPlannerAccept;
}

export interface EdamamMealPlannerAccept {
    all: EdamamMealPlannerAcceptRule[];
}

export type EdamamMealPlannerAcceptRule = Record<string, string[]>;

export interface EdamamMealPlannerPlan {
    fit: EdamamNutrientFit;
    sections: Record<string, EdamamMealPlannerSectionRequest>;
}

export interface EdamamMealPlannerSelectRequest {
    size: number;
    plan: EdamamMealPlannerPlan;
}

export interface EdamamLink {
    href: string;
    title: string;
}

export interface EdamamMealPlannerSectionResponse {
    assigned: string;
    _links: {
        self: EdamamLink;
    };
}

export interface EdamamMealPlannerSelection {
    sections: Record<string, EdamamMealPlannerSectionResponse>;
}

export interface EdamamMealPlannerSelectResponse {
    selection: EdamamMealPlannerSelection[];
    status: string;
}

export interface EdamamRecipeResponse {
    recipe: EdamamRecipe;
    _links: {
        self: EdamamLink;
    };
}

export interface EdamamRecipe {
    uri: string;
    label: string;
    image: string;
    images: Record<string, EdamamRecipeImage>;
    source: string;
    url: string;
    shareAs: string;
    yield: number;
    dietLabels: string[];
    healthLabels: string[];
    cautions: string[];
    ingredientLines: string[];
    ingredients: EdamamRecipeIngredient[];
    calories: number;
    totalCO2Emissions: number;
    co2EmissionsClass: string;
    totalWeight: number;
    totalTime: number;
    cuisineType: string[];
    mealType: string[];
    dishType: string[];
    totalNutrients: Record<string, EdamamNutrient>;
    totalDaily: Record<string, EdamamNutrient>;
    digest: EdamamDigestItem[];
}

export interface EdamamRecipeImage {
    url: string;
    width: number;
    height: number;
}

export interface EdamamRecipeIngredient {
    text: string;
    quantity: number;
    measure: string | null;
    food: string;
    weight: number;
    foodCategory: string;
    foodId: string;
    image: string;
}

export interface EdamamNutrient {
    label: string;
    quantity: number;
    unit: string;
}

export interface EdamamDigestItem {
    label: string;
    tag: string;
    schemaOrgTag: string | null;
    total: number;
    hasRDI: boolean;
    daily: number;
    unit: string;
    sub?: EdamamDigestItem[];
}
