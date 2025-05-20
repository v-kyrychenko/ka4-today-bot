const fs = require('fs');
const path = require('path');

const functionName = process.argv[2];
const envFile = path.resolve('.env');
const outputFile = path.resolve('env.tmp.json');

if (!functionName) {
    console.error('❌ Missing function name. Usage: node genEnvJson.cjs <FunctionName>');
    process.exit(1);
}

try {
    const raw = fs.readFileSync(envFile, 'utf-8');

    const lines = raw
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

    const envVars = Object.fromEntries(
        lines.map(line => {
            const [key, ...val] = line.split('=');
            return [key.trim(), val.join('=').trim()];
        })
    );

    const result = {
        [functionName]: envVars,
    };

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`✅ Generated ${outputFile} for function "${functionName}"`);
} catch (err) {
    console.error(`❌ Failed to generate env.tmp.json:`, err.message);
    process.exit(1);
}
