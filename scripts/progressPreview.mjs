// Usage: npm run progress-preview
// Renders the sample progress template to tmp/progress-preview.png.

import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {build} from 'esbuild';

const workdir = process.cwd();
const outfile = path.resolve(workdir, 'tmp', 'progress-preview.bundle.mjs');

try {
    await build({
        entryPoints: [path.resolve(workdir, 'scripts', 'progressPreviewEntry.ts')],
        outfile,
        bundle: true,
        format: 'esm',
        packages: 'external',
        platform: 'node',
        target: 'node22',
        sourcemap: false
    });

    const {runProgressPreview} = await import(pathToFileURL(outfile).href);
    await runProgressPreview();

    console.log(`Progress preview written to ${path.resolve(workdir, 'tmp', 'progress-preview.png')}`);
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed to render progress preview: ${err.message}`);
    process.exit(1);
}
