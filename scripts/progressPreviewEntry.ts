import fs from 'node:fs';
import path from 'node:path';

import {renderPng} from '../src/modules/telegram/commands/progress/renderPng.js';
import {sampleViewModel} from '../test/modules/telegram/commands/progress/sampleViewModel.js';

const OUTPUT_PATH = path.resolve(process.cwd(), 'tmp', 'progress-preview.png');

export async function runProgressPreview(): Promise<void> {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), {recursive: true});

    const png = await renderPng(sampleViewModel);
    fs.writeFileSync(OUTPUT_PATH, png);
}
