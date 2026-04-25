import fs from 'node:fs';
import path from 'node:path';

const functionName = process.argv[2];
const envFile = path.resolve('.env');
const outputFile = path.resolve('env.tmp.json');

const functionAliases = {
    HttpApiClients: ['HttpApiClientRoutes', 'HttpApiExerciseRoutes'],
};

if (!functionName) {
    console.error('Missing function name. Usage: node scripts/genEnvJson.mjs <FunctionName>');
    process.exit(1);
}

try {
    const raw = fs.readFileSync(envFile, 'utf-8');

    const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));

    const envVars = Object.fromEntries(
        lines.map((line) => {
            const [key, ...val] = line.split('=');
            return [key.trim(), val.join('=').trim()];
        })
    );

    const targetFunctions = functionAliases[functionName] ?? [functionName];
    const result = Object.fromEntries(
        targetFunctions.map((targetFunctionName) => [targetFunctionName, envVars])
    );

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(
        `Generated ${outputFile} for function target${targetFunctions.length > 1 ? 's' : ''} "${targetFunctions.join('", "')}"`,
    );
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed to generate env.tmp.json: ${err.message}`);
    process.exit(1);
}
