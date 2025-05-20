const { execSync } = require('child_process');

const [,, functionName, eventPath] = process.argv;

if (!functionName || !eventPath) {
    console.error('❌ Usage: npm run local -- <FunctionName> <event-file>');
    process.exit(1);
}

try {
    console.log(`🛠 Generating env for ${functionName}...`);
    execSync(`node scripts/genEnvJson.cjs ${functionName}`, { stdio: 'inherit' });

    console.log(`🚀 Running sam local invoke ${functionName}...`);
    execSync(`sam local invoke ${functionName} --event ${eventPath} --env-vars env.tmp.json`, { stdio: 'inherit' });

    console.log(`🧹 Cleaning up env.tmp.json...`);
    execSync(`rm env.tmp.json`, { stdio: 'inherit' });

    console.log('✅ Done!');
} catch (err) {
    console.error('❌ Failed during local run:', err.message);
    process.exit(1);
}
