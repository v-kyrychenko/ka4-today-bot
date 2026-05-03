import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('httpRequest uses logUrl for logs and error messages', async () => {
    const module = await loadHttpClient();
    const logs = [];
    const errors = [];

    globalThis.__httpClientTestLogs = {logs, errors};
    globalThis.fetch = async (url) => {
        assert.equal(url, 'https://example.com/secret');

        return new Response(JSON.stringify({message: 'failed'}), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        });
    };

    await assert.rejects(
        module.httpRequest({
            method: 'POST',
            path: '/secret',
            endpointUrl: 'https://example.com',
            logUrl: 'https://example.com/****',
            headers: {'Content-Type': 'application/json'},
            body: {hello: 'world'},
            label: 'HTTP',
            errorClass: Error,
        }),
        (error) => {
            assert.match(error.message, /https:\/\/example\.com\/\*\*\*\*/);
            assert.doesNotMatch(error.message, /https:\/\/example\.com\/secret/);
            return true;
        }
    );

    assert.match(logs[0], /https:\/\/example\.com\/\*\*\*\*/);
    assert.doesNotMatch(logs[0], /https:\/\/example\.com\/secret/);
    assert.match(errors[0], /https:\/\/example\.com\/\*\*\*\*/);
    assert.doesNotMatch(errors[0], /https:\/\/example\.com\/secret/);
});

test('httpRequest keeps original logging behavior when logUrl is omitted', async () => {
    const module = await loadHttpClient();
    const logs = [];
    const errors = [];

    globalThis.__httpClientTestLogs = {logs, errors};
    globalThis.fetch = async () =>
        new Response(JSON.stringify({ok: true}), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        });

    await module.httpRequest({
        method: 'GET',
        path: '/plain',
        endpointUrl: 'https://example.com',
        label: 'HTTP',
    });

    assert.match(logs[0], /https:\/\/example\.com\/plain/);
    assert.match(logs[1], /https:\/\/example\.com\/plain/);
    assert.equal(errors.length, 0);
});

test('buildRequest passes FormData through and uses a safe printable marker', async () => {
    const module = await loadHttpClient();
    const formData = new FormData();
    formData.set('caption', 'hello');

    const {requestInit, printableBody} = module.buildRequest('POST', {}, formData);

    assert.equal(requestInit.body, formData);
    assert.equal(printableBody, '#form-data');
});

async function loadHttpClient() {
    const outfile = path.join(tmpdir(), `http-client-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/shared/http/httpClient.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [httpClientMocks],
    });

    try {
        return await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
    } finally {
        await rm(outfile, {force: true});
    }
}

const httpClientMocks = {
    name: 'http-client-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /^\.\.\/logging$/}, () => ({
            namespace: 'http-client-mock',
            path: 'logging',
        }));

        buildContext.onLoad({filter: /^logging$/, namespace: 'http-client-mock'}, () => ({
            contents: [
                'export function log(message) {',
                '    globalThis.__httpClientTestLogs.logs.push(message);',
                '}',
                'export function logError(message) {',
                '    globalThis.__httpClientTestLogs.errors.push(message);',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};
