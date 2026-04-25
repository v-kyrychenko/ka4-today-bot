import fs from 'node:fs';
import path from 'node:path';

import {renderProgressPng} from '../src/modules/telegram/commands/progress/renderProgressPng.js';
import {progressSampleViewModel} from '../src/modules/telegram/commands/progress/sampleProgressViewModel.js';

const OUTPUT_PATH = path.resolve(process.cwd(), 'tmp', 'progress-preview.png');

export async function runProgressPreview(): Promise<void> {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), {recursive: true});

    const png = await renderProgressPng(progressSampleViewModel);
    fs.writeFileSync(OUTPUT_PATH, png);
}
