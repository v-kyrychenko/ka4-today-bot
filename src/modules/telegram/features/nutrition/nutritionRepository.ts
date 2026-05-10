import {asc, eq, sql} from 'drizzle-orm';
import {nutritionMapper} from '../../../../infrastructure/persistence/postgres/mappers/nutritionMapper.js';
import {getPostgresDb} from '../../../../infrastructure/persistence/postgres/postgresDb.js';
import {
    nFoodDict,
    nMealItem,
    nMealTemplate,
} from '../../../../infrastructure/persistence/postgres/schema/nutrition.js';
import type {MealItemRole, MealTemplate, MealType} from './nutritionModel.js';

export const nutritionRepository = {
    findMealTemplatesByMealType,
};

export async function findMealTemplatesByMealType(mealType: MealType): Promise<MealTemplate[]> {
    const rows = await getPostgresDb()
        .select({
            template_id: nMealTemplate.id,
            template_key: nMealTemplate.key,
            is_active: nMealTemplate.is_active,
            meal_type: nMealTemplate.meal_type,
            title: nMealTemplate.title,
            goal_tags: nMealTemplate.goal_tags,
            day_tags: nMealTemplate.day_tags,
            item_id: nMealItem.id,
            item_amount: nMealItem.amount,
            item_unit: nMealItem.unit,
            item_role: sql<MealItemRole>`${nMealItem.role}`,
            adjustable: nMealItem.adjustable,
            min_amount: nMealItem.min_amount,
            max_amount: nMealItem.max_amount,
            food_id: nFoodDict.id,
            food_key: nFoodDict.key,
            food_name: nFoodDict.name,
            category: nFoodDict.category,
            food_amount: nFoodDict.amount,
            food_unit: nFoodDict.unit,
            calories: nFoodDict.calories,
            protein: nFoodDict.protein,
            fat: nFoodDict.fat,
            carbs: nFoodDict.carbs,
            meal_roles: nFoodDict.meal_roles,
            flags: nFoodDict.flags,
        })
        .from(nMealTemplate)
        .innerJoin(nMealItem, eq(nMealItem.n_meal_template_id, nMealTemplate.id))
        .innerJoin(nFoodDict, eq(nFoodDict.id, nMealItem.n_food_dict_id))
        .where(eq(nMealTemplate.meal_type, mealType))
        .orderBy(asc(nMealTemplate.id), asc(nMealItem.id));

    return nutritionMapper.toMealTemplates(rows);
}
