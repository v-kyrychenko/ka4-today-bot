import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('clientMapper maps nullable height', async () => {
    const {clientMapper} = await loadClientMapper();

    assert.equal(clientMapper.toAppModel(createClientRow({height: '181.5'})).height, 181.5);
    assert.equal(clientMapper.toAppModel(createClientRow({height: null})).height, null);
});

test('clientMapper writes height with one decimal place', async () => {
    const {clientMapper} = await loadClientMapper();

    const row = clientMapper.toCreateRow(createClientInput({height: 181.55}), 10, '2026-05-13T00:00:00.000Z');
    const update = clientMapper.toUpdateRow({height: 170});

    assert.equal(row.height, '181.6');
    assert.equal(update.height, '170.0');
    assert.equal(clientMapper.toUpdateRow({height: null}).height, null);
});

async function loadClientMapper() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/infrastructure/persistence/postgres/mappers/clientMapper.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

function createClientRow(input = {}) {
    return {
        id: 1,
        coach_id: 10,
        first_name: 'Test',
        last_name: 'Client',
        status: 'ACTIVE',
        gender: 'M',
        lang: 'uk',
        birthday: '1989-01-15',
        height: '180.0',
        created_at: '2026-05-13T00:00:00.000Z',
        last_activity: null,
        goals: null,
        notes: null,
        ...input,
    };
}

function createClientInput(input = {}) {
    return {
        firstName: 'Test',
        lastName: 'Client',
        status: 'ACTIVE',
        gender: 'M',
        lang: 'uk',
        birthday: '1989-01-15',
        goals: null,
        notes: null,
        ...input,
    };
}
