import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('nutritionMapper maps nMealTemplate.is_active to MealTemplate.active', async () => {
    const {nutritionMapper} = await loadNutritionMapper();

    const [template] = nutritionMapper.toMealTemplates([createMealTemplateRow({is_active: false})]);

    assert.equal(template.active, false);
});

async function loadNutritionMapper() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const outfile = path.join(tmpdir(), `nutrition-mapper-${process.pid}-${cacheKey}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/infrastructure/persistence/postgres/mappers/nutritionMapper.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
    });

    try {
        return await import(`${pathToFileURL(outfile).href}?cache=${cacheKey}`);
    } finally {
        await rm(outfile, {force: true});
    }
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
