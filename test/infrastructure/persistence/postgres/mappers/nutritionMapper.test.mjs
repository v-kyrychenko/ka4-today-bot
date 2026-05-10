import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('nutritionMapper maps nMealTemplate.is_active to MealTemplate.active', async () => {
    const {nutritionMapper} = await loadNutritionMapper();

    const [template] = nutritionMapper.toMealTemplates([createMealTemplateRow({is_active: false})]);

    assert.equal(template.active, false);
});

async function loadNutritionMapper() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/infrastructure/persistence/postgres/mappers/nutritionMapper.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

function createMealTemplateRow(input = {}) {
    return {
        template_id: 1,
        template_key: 'breakfast_eggs',
        is_active: input.is_active ?? true,
        meal_type: 'breakfast',
        title: {en: 'Breakfast eggs'},
        goal_tags: ['fat_loss'],
        day_tags: ['training_day'],
        item_id: 10,
        item_amount: '100',
        item_unit: 'g',
        item_role: 'main_protein',
        adjustable: true,
        min_amount: null,
        max_amount: null,
        food_id: 20,
        food_key: 'egg_large',
        food_name: {en: 'Egg'},
        category: 'protein',
        food_amount: '100',
        food_unit: 'g',
        calories: '100',
        protein: '10',
        fat: '1',
        carbs: '1',
        meal_roles: ['breakfast'],
        flags: [],
    };
}
