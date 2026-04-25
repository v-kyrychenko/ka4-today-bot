import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const [, , functionName, eventPath] = process.argv;

if (!functionName || !eventPath) {
    console.error('Usage: npm run local -- <FunctionName> <event-file>');
    process.exit(1);
}

try {
    runCommand('node', ['scripts/genEnvJson.mjs', functionName], `Generating env for ${functionName}...`);
    runCommand(
        'sam',
        ['local', 'invoke', functionName, '--event', eventPath, '--skip-pull-image', '--env-vars', 'env.tmp.json'],
        `Running sam local invoke ${functionName}...`
    );
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed during local run: ${err.message}`);
    process.exit(1);
} finally {
    if (fs.existsSync('env.tmp.json')) {
        fs.rmSync('env.tmp.json');
    }
}

function runCommand(command, args, message) {
    console.log(message);
    const result = spawnSync(command, args, {stdio: 'inherit'});

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}`);
    }
}
