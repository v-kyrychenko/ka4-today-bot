import fs from 'node:fs';
import path from 'node:path';

import satori from 'satori';
import {Resvg} from '@resvg/resvg-js';

import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';

const IMAGE_WIDTH = 1400;
const IMAGE_HEIGHT = 1600;
const FONT_FILE_NAME = 'Inter-Regular.ttf';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const png = await renderProgressPocImage();

        await telegramMessagingService.sendWithMedia(context, {
            buffer: png,
            filename: 'progress-poc.png'
        }, '📊 Progress POC \n Waist is moving down while weight stays controlled. Looks like recomposition, not just weight loss.');
    }
}

async function renderProgressPocImage(): Promise<Buffer> {
    const font = loadFont();

    const svg = await satori(createTemplate(), {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: [
            {
                name: 'Inter',
                data: font,
                weight: 400,
                style: 'normal'
            }
        ]
    });

    return Buffer.from(new Resvg(svg).render().asPng());
}

function createTemplate(): object {
    return {
        type: 'div',
        props: {
            style: createRootStyle(),
            children: [
                createLabel(),
                createTitle(),
                createCardGrid(),
                createInsight()
            ]
        }
    };
}

function createRootStyle(): object {
    return {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        padding: '80px',
        background: '#0B0F14',
        color: '#E6EDF3',
        fontFamily: 'Inter',
        gap: '42px'
    };
}

function createLabel(): object {
    return createText('KA4 TODAY · PROGRESS', {
        color: '#A3FF3F',
        fontSize: 30,
        letterSpacing: 4
    });
}

function createTitle(): object {
    return createText('Body progress check', {
        fontSize: 72,
        fontWeight: 700,
        lineHeight: 1.05
    });
}

function createCardGrid(): object {
    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '28px'
            },
            children: [
                createMetricCard('Weight', '77.8 kg', '↓ 0.7 kg'),
                createMetricCard('Waist', '86 cm', '↓ 3 cm'),
                createMetricCard('Chest', '102 cm', 'stable'),
                createMetricCard('Mood', 'Good', 'training ready')
            ]
        }
    };
}

function createMetricCard(label: string, value: string, delta: string): object {
    return {
        type: 'div',
        props: {
            style: {
                width: '430px',
                height: '210px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '32px',
                borderRadius: '34px',
                background: '#121821',
                border: '2px solid #24301F'
            },
            children: [
                createText(label, {color: '#8B98A5', fontSize: 30}),
                createText(value, {fontSize: 58, fontWeight: 700}),
                createText(delta, {color: '#A3FF3F', fontSize: 32})
            ]
        }
    };
}

function createInsight(): object {
    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexDirection: 'column',
                padding: '36px',
                borderRadius: '34px',
                background: '#10161D',
                border: '2px solid #A3FF3F',
                gap: '18px'
            },
            // children: [
            //     createText('Insight', {
            //         color: '#A3FF3F',
            //         fontSize: 34,
            //         fontWeight: 700
            //     }),
            //     createText('Waist is moving down while weight stays controlled. Looks like recomposition, not just weight loss.', {
            //         color: '#E6EDF3',
            //         fontSize: 38,
            //         lineHeight: 1.35
            //     })
            // ]
        }
    };
}

function createText(text: string, style: object): object {
    return {
        type: 'div',
        props: {
            style,
            children: text
        }
    };
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
