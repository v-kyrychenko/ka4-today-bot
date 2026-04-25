import fs from 'node:fs';
import path from 'node:path';

import {Resvg} from '@resvg/resvg-js';
import satori from 'satori';

import {
    PROGRESS_FONT_FAMILY,
    PROGRESS_FONT_FILE_NAME,
    PROGRESS_IMAGE_HEIGHT,
    PROGRESS_IMAGE_WIDTH
} from './progressStyles.js';
import {createProgressTemplate} from './progressTemplate.js';
import type {ProgressViewModel} from './progressViewModel.js';

export async function renderProgressPng(viewModel: ProgressViewModel): Promise<Buffer> {
    const font = loadFont();
    const svg = await satori(createProgressTemplate(viewModel), {
        width: PROGRESS_IMAGE_WIDTH,
        height: PROGRESS_IMAGE_HEIGHT,
        fonts: [
            {
                name: PROGRESS_FONT_FAMILY,
                data: font,
                weight: 400,
                style: 'normal'
            }
        ]
    });

    return Buffer.from(new Resvg(svg).render().asPng());
}

function loadFont(): Buffer {
    return fs.readFileSync(resolveAssetPath(PROGRESS_FONT_FILE_NAME));
}

function resolveAssetPath(fileName: string): string {
    const candidates = [
        path.resolve(process.cwd(), 'assets', fileName),
        path.resolve('/var/task', 'assets', fileName),
        path.resolve('/opt', 'assets', fileName),
        path.resolve('/opt', 'nodejs', 'assets', fileName)
    ];

    const foundPath = candidates.find(fs.existsSync);

    if (!foundPath) {
        throw new Error(`Asset not found: ${fileName}`);
    }

    return foundPath;
}
