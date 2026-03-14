import fs from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';

const [, , functionName] = process.argv;

if (!functionName) {
    console.error('Usage: npm run local-api -- <FunctionName>');
    process.exit(1);
}

try {
    runCommand(
        'node',
        ['scripts/genEnvJson.mjs', functionName],
        `Generating env for ${functionName}...`
    );

    const child = spawn(
        'sam',
        ['local', 'start-api', '--env-vars', 'env.tmp.json'],
        { stdio: 'inherit' }
    );

    child.on('exit', (code) => {
        cleanup();
        process.exit(code ?? 0);
    });

    child.on('error', (error) => {
        console.error(`Failed to start API: ${error.message}`);
        cleanup();
        process.exit(1);
    });

    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed during local API run: ${err.message}`);
    cleanup();
    process.exit(1);
}

function runCommand(command, args, message) {
    console.log(message);

    const result = spawnSync(command, args, { stdio: 'inherit' });

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}`);
    }
}

function cleanup() {
    if (fs.existsSync('env.tmp.json')) {
        fs.rmSync('env.tmp.json');
    }
}
