import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('calculateDailyNutritionPlan logs maintenance targets for an 81 kg male client', async () => {
    const module = await loadMacroTargetsCalculator();
    const result = module.calculateMacroTargets({
        clientId: 101,
        gender: 'M',
        birthday: '1989-01-15',
        goal: 'maintenance',
        height: 182,
        activityLevel: 'active',
        dayType: 'training_day',
        weight: {
            id: 1,
            clientId: 101,
            createdAt: '2026-05-10T00:00:00.000Z',
            amount: 81,
            type: 'WEIGHT',
            unitKey: 'kg',
        },
    });

    console.log('### MACRO_TARGETS_CALCULATOR:result', result);

    assert.deepEqual(result, {
        calories: 2740,
        protein: 130,
        fat: 76,
        carbs: 384,
    });
});

test('calculateMacroTargets logs maintenance targets for an active female training day', async () => {
    const module = await loadMacroTargetsCalculator();
    const result = module.calculateMacroTargets({
        clientId: 102,
        gender: 'F',
        birthday: '1991-10-01',
        goal: 'maintenance',
        height: 167,
        activityLevel: 'active',
        dayType: 'training_day',
        weight: {
            id: 2,
            clientId: 102,
            createdAt: '2026-05-10T00:00:00.000Z',
            amount: 60,
            type: 'WEIGHT',
            unitKey: 'kg',
        },
    });

    console.log('### MACRO_TARGETS_CALCULATOR:female-active-training-day-result', result);

    assert.deepEqual(result, {
        calories: 2035,
        protein: 96,
        fat: 57,
        carbs: 285,
    });
});

async function loadMacroTargetsCalculator() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/macroTargetsCalculator.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}
