import fs from 'node:fs';
import path from 'node:path';

import {Resvg} from '@resvg/resvg-js';
import satori from 'satori';

import {FONT_FAMILY, FONT_FILE_NAME, IMAGE_HEIGHT, IMAGE_WIDTH} from './template/styles.js';
import {createTemplate} from './template/template.js';
import type {ViewModel} from './template/viewModel.js';

export async function renderPng(viewModel: ViewModel): Promise<Buffer> {
    const font = loadFont();
    const svg = await satori(createTemplate(viewModel), {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: [
            {
                name: FONT_FAMILY,
                data: font,
                weight: 400,
                style: 'normal'
            }
        ]
    });

    return Buffer.from(new Resvg(svg).render().asPng());
}

function loadFont(): Buffer {
    return fs.readFileSync(resolveAssetPath(FONT_FILE_NAME));
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
