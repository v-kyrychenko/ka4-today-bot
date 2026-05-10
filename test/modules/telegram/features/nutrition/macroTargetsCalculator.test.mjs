import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('calculateDailyNutritionPlan logs maintenance targets for an 81 kg male client', async () => {
    const module = await loadMacroTargetsCalculator();
    const result = module.calculateDailyNutritionPlan({
        clientId: 101,
        gender: 'M',
        birthday: '15.01.1989',
        goal: 'maintenance',
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
        calories: 2592,
        protein: 130,
        fat: 72,
        carbs: 356,
    });
});

async function loadMacroTargetsCalculator() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const outfile = path.join(tmpdir(), `macro-targets-calculator-${process.pid}-${cacheKey}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/macroTargetsCalculator.ts'],
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
