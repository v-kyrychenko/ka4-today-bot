import type {DayTag, GoalTag, MealTemplate, MealType} from "../nutritionModel";

export type MealTemplateFallbackLevel = 'strict' | 'relax_anti_repeat' | 'relax_day_type' | 'relax_goal';

export interface MealTemplatePickerConfig {
    avoidSameTemplateDays: number;
    avoidSameMainProteinDays: number;
    recentTemplatePenalty: number;
    yesterdayTemplatePenalty: number;
    sameMainProteinPenalty: number;
    preferredFoodBonus: number;
    preferredBreakfastStyleBonus: number;
    proteinBoosterBonus: number;
    minScore: number;
}

export interface MealTemplateExclusions {
    allergyFoodKeys?: string[];
    excludedFoodKeys?: string[];
    dietaryRestrictionFoodKeys?: string[];
    excludedFoodFlags?: string[];
}

export interface MealTemplatePreferences {
    preferredFoodKeys?: string[];
    preferredBreakfastStyles?: string[];
}

export interface RecentMealTemplate {
    templateId?: number;
    templateKey?: string;
    mealType: MealType;
    usedAt: string;
    mainProteinFoodKeys?: string[];
}

export interface MealTemplatePickerRequest {
    clientId: number;
    mealType: MealType;
    goal: GoalTag;
    dayType: DayTag;
    targetDate?: string;
    exclusions?: MealTemplateExclusions;
    preferences?: MealTemplatePreferences;
    recentTemplates?: RecentMealTemplate[];
    config?: Partial<MealTemplatePickerConfig>;
    random?: () => number;
}

export interface MealTemplatePickMetadata {
    fallbackLevel: MealTemplateFallbackLevel;
    candidateCount: number;
    scoredCandidateCount: number;
    loadedTemplateCount: number;
    activeTemplateCount: number;
    excludedFoodCount: number;
    recentTemplateCount: number;
    selectedTemplateKey: string;
}

export interface MealTemplatePickResult {
    template: MealTemplate;
    fallbackLevel: MealTemplateFallbackLevel;
    reason: string;
    score: number;
    metadata: MealTemplatePickMetadata;
}

export interface PickerContext {
    request: MealTemplatePickerRequest;
    config: MealTemplatePickerConfig;
    targetDate: string;
    excludedFoodKeys: Set<string>;
    excludedFoodFlags: Set<string>;
    preferredFoodKeys: Set<string>;
    preferredBreakfastStyles: Set<string>;
    recentTemplates: RecentMealTemplate[];
    random: () => number;
}

export interface FallbackRule {
    level: MealTemplateFallbackLevel;
    reason: string;
    includeGoal: boolean;
    includeDayType: boolean;
    includeAntiRepeat: boolean;
}

export interface ScoredMealTemplate {
    template: MealTemplate;
    score: number;
}

export class MealTemplateNotFoundError extends Error {
    readonly clientId: number;
    readonly mealType: MealType;
    readonly goal: GoalTag;
    readonly dayType: DayTag;
    readonly excludedFoodCount: number;

    constructor(context: PickerContext) {
        super(`No valid meal template found for ${context.request.mealType}`);
        this.name = 'MealTemplateNotFoundError';
        this.clientId = context.request.clientId;
        this.mealType = context.request.mealType;
        this.goal = context.request.goal;
        this.dayType = context.request.dayType;
        this.excludedFoodCount = context.excludedFoodKeys.size + context.excludedFoodFlags.size;
    }
}