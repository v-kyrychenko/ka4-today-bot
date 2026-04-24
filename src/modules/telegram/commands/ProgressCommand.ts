import {deflateSync} from 'zlib';
import {telegramMessagingService} from '../application/telegramMessagingService.js';
import type {ProcessorContext} from '../domain/context.js';
import {BaseCommand} from './BaseCommand.js';
import {PROGRESS_COMMAND} from './registry.js';

type Rgba = [number, number, number, number];

type ProgressMetric = {
    current: number;
    delta: number;
};

type ProgressPoint = {
    weight: number;
    waist: number;
};

type ProgressData = {
    period: string;
    weight: ProgressMetric;
    waist: ProgressMetric;
    points: ProgressPoint[];
    insight: string;
};

const WIDTH = 900;
const HEIGHT = 1200;

const COLORS = {
    background: [248, 250, 252, 255] as Rgba,
    card: [255, 255, 255, 255] as Rgba,
    shadow: [15, 23, 42, 12] as Rgba,
    blue: [37, 99, 235, 255] as Rgba,
    blueSoft: [191, 219, 254, 255] as Rgba,
    green: [22, 163, 74, 255] as Rgba,
    greenSoft: [187, 247, 208, 255] as Rgba,
    slate: [71, 85, 105, 255] as Rgba,
    slateSoft: [203, 213, 225, 255] as Rgba,
    amber: [245, 158, 11, 255] as Rgba,
};

const CRC32_TABLE = buildCrc32Table();

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const progress = this.buildFakeProgress();
        const pngBuffer = this.renderPng(progress);

        await telegramMessagingService.sendPhoto(context, pngBuffer, {
            filename: 'progress.png',
            caption: '📊 Прогрес',
        });
    }

    private renderPng(progress: ProgressData): Buffer {
        const canvas = this.createCanvas(WIDTH, HEIGHT, COLORS.background);

        this.drawHeader(canvas);
        this.drawMetricCard(canvas, 50, 160, 250, 200, COLORS.blue, progress.weight);
        this.drawMetricCard(canvas, 320, 160, 250, 200, COLORS.green, progress.waist);
        this.drawSummaryCard(canvas, 590, 160, 260, 200, progress);
        this.drawChartCard(canvas, 50, 420, 800, 350, progress);
        this.drawInsightCard(canvas, 50, 820, 800, 260);

        return encodePng(canvas.width, canvas.height, canvas.data);
    }

    private drawHeader(canvas: Canvas): void {
        this.drawRoundedRect(canvas, 40, 40, 820, 90, 26, COLORS.card, COLORS.shadow);
        this.drawRoundedRect(canvas, 60, 62, 46, 46, 16, COLORS.blue);
        this.drawRoundedRect(canvas, 120, 68, 220, 14, 7, COLORS.slate);
        this.drawRoundedRect(canvas, 120, 92, 160, 10, 5, COLORS.slateSoft);
        this.drawRoundedRect(canvas, 700, 66, 120, 18, 9, COLORS.blueSoft);
        this.drawRoundedRect(canvas, 700, 92, 90, 10, 5, COLORS.greenSoft);
    }

    private drawMetricCard(
        canvas: Canvas,
        x: number,
        y: number,
        width: number,
        height: number,
        accentColor: Rgba,
        metric: ProgressMetric,
    ): void {
        this.drawRoundedRect(canvas, x, y, width, height, 24, COLORS.card, COLORS.shadow);
        this.drawRoundedRect(canvas, x + 22, y + 24, 54, 12, 6, COLORS.slateSoft);

        const normalized = Math.max(0.2, Math.min(1, metric.current / 100));
        this.drawRoundedRect(canvas, x + 22, y + 70, 150, 54, 18, accentColor);
        this.drawRoundedRect(canvas, x + 22, y + 142, 180, 16, 8, COLORS.slateSoft);
        this.drawRoundedRect(canvas, x + 22, y + 142, Math.round(180 * normalized), 16, 8, accentColor);

        const deltaColor = metric.delta <= 0 ? COLORS.green : COLORS.amber;
        const deltaWidth = Math.min(90, 28 + Math.round(Math.abs(metric.delta) * 16));
        this.drawRoundedRect(canvas, x + 22, y + 174, deltaWidth, 12, 6, deltaColor);
    }

    private drawSummaryCard(canvas: Canvas, x: number, y: number, width: number, height: number, progress: ProgressData): void {
        this.drawRoundedRect(canvas, x, y, width, height, 24, COLORS.card, COLORS.shadow);
        this.drawRoundedRect(canvas, x + 22, y + 24, 120, 12, 6, COLORS.slateSoft);
        this.drawRoundedRect(canvas, x + 22, y + 58, 180, 18, 9, COLORS.blueSoft);
        this.drawRoundedRect(canvas, x + 22, y + 94, 150, 12, 6, COLORS.slateSoft);

        const periodStrength = Math.min(progress.points.length / 6, 1);
        for (let index = 0; index < 5; index += 1) {
            const color = index / 4 <= periodStrength ? COLORS.blue : COLORS.slateSoft;
            this.drawRoundedRect(canvas, x + 22 + index * 42, y + 136, 24, 44 + index * 8, 8, color);
        }

        this.drawRoundedRect(canvas, x + 22, y + 178, 190, 10, 5, COLORS.greenSoft);
    }

    private drawChartCard(canvas: Canvas, x: number, y: number, width: number, height: number, progress: ProgressData): void {
        this.drawRoundedRect(canvas, x, y, width, height, 24, COLORS.card, COLORS.shadow);

        const chartX = x + 30;
        const chartY = y + 40;
        const chartWidth = width - 60;
        const chartHeight = height - 80;

        for (let index = 0; index < 4; index += 1) {
            const gridY = chartY + Math.round((chartHeight / 3) * index);
            this.drawRoundedRect(canvas, chartX, gridY, chartWidth, 2, 1, COLORS.slateSoft);
        }

        const allValues = progress.points.flatMap((point) => [point.weight, point.waist]);
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);

        this.drawSeries(canvas, progress.points.map((point) => point.weight), chartX, chartY, chartWidth, chartHeight, minValue, maxValue, COLORS.blue);
        this.drawSeries(canvas, progress.points.map((point) => point.waist), chartX, chartY, chartWidth, chartHeight, minValue, maxValue, COLORS.green);
    }

    private drawSeries(
        canvas: Canvas,
        values: number[],
        x: number,
        y: number,
        width: number,
        height: number,
        minValue: number,
        maxValue: number,
        color: Rgba,
    ): void {
        const points = values.map((value, index) => {
            const pointX = x + Math.round((width / Math.max(values.length - 1, 1)) * index);
            const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
            const pointY = y + height - Math.round(ratio * height);
            return {x: pointX, y: pointY};
        });

        for (let index = 1; index < points.length; index += 1) {
            this.drawLine(canvas, points[index - 1].x, points[index - 1].y, points[index].x, points[index].y, color, 4);
        }

        for (const point of points) {
            this.drawCircle(canvas, point.x, point.y, 7, color);
        }
    }

    private drawInsightCard(canvas: Canvas, x: number, y: number, width: number, height: number): void {
        this.drawRoundedRect(canvas, x, y, width, height, 24, COLORS.card, COLORS.shadow);
        this.drawRoundedRect(canvas, x + 22, y + 24, 140, 14, 7, COLORS.slate);
        this.drawRoundedRect(canvas, x + 22, y + 64, width - 120, 14, 7, COLORS.slateSoft);
        this.drawRoundedRect(canvas, x + 22, y + 92, width - 180, 14, 7, COLORS.slateSoft);
        this.drawRoundedRect(canvas, x + 22, y + 120, width - 150, 14, 7, COLORS.slateSoft);

        this.drawRoundedRect(canvas, x + 22, y + 174, 220, 44, 16, COLORS.greenSoft);
        this.drawRoundedRect(canvas, x + 270, y + 174, 180, 44, 16, COLORS.blueSoft);
    }

    private createCanvas(width: number, height: number, background: Rgba): Canvas {
        const data = new Uint8Array(width * height * 4);

        for (let index = 0; index < data.length; index += 4) {
            data[index] = background[0];
            data[index + 1] = background[1];
            data[index + 2] = background[2];
            data[index + 3] = background[3];
        }

        return {width, height, data};
    }

    private drawRoundedRect(
        canvas: Canvas,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        fill: Rgba,
        shadow?: Rgba,
    ): void {
        if (shadow) {
            this.fillRoundedRect(canvas, x + 6, y + 8, width, height, radius, shadow);
        }

        this.fillRoundedRect(canvas, x, y, width, height, radius, fill);
    }

    private fillRoundedRect(
        canvas: Canvas,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        color: Rgba,
    ): void {
        const maxX = Math.min(canvas.width, x + width);
        const maxY = Math.min(canvas.height, y + height);
        const clampedRadius = Math.min(radius, Math.floor(width / 2), Math.floor(height / 2));
        const cornerRadiusSquared = clampedRadius * clampedRadius;

        for (let currentY = Math.max(0, y); currentY < maxY; currentY += 1) {
            for (let currentX = Math.max(0, x); currentX < maxX; currentX += 1) {
                const localX = currentX - x;
                const localY = currentY - y;

                const dx = localX < clampedRadius
                    ? clampedRadius - localX
                    : localX >= width - clampedRadius
                        ? localX - (width - clampedRadius - 1)
                        : 0;

                const dy = localY < clampedRadius
                    ? clampedRadius - localY
                    : localY >= height - clampedRadius
                        ? localY - (height - clampedRadius - 1)
                        : 0;

                if (dx === 0 || dy === 0 || dx * dx + dy * dy <= cornerRadiusSquared) {
                    this.setPixel(canvas, currentX, currentY, color);
                }
            }
        }
    }

    private drawLine(canvas: Canvas, x1: number, y1: number, x2: number, y2: number, color: Rgba, thickness: number): void {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const steps = Math.max(dx, dy, 1);

        for (let step = 0; step <= steps; step += 1) {
            const ratio = step / steps;
            const x = Math.round(x1 + (x2 - x1) * ratio);
            const y = Math.round(y1 + (y2 - y1) * ratio);
            this.drawCircle(canvas, x, y, Math.max(1, Math.floor(thickness / 2)), color);
        }
    }

    private drawCircle(canvas: Canvas, centerX: number, centerY: number, radius: number, color: Rgba): void {
        const radiusSquared = radius * radius;

        for (let y = centerY - radius; y <= centerY + radius; y += 1) {
            for (let x = centerX - radius; x <= centerX + radius; x += 1) {
                const dx = x - centerX;
                const dy = y - centerY;

                if (dx * dx + dy * dy <= radiusSquared) {
                    this.setPixel(canvas, x, y, color);
                }
            }
        }
    }

    private setPixel(canvas: Canvas, x: number, y: number, color: Rgba): void {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
            return;
        }

        const index = (y * canvas.width + x) * 4;
        canvas.data[index] = color[0];
        canvas.data[index + 1] = color[1];
        canvas.data[index + 2] = color[2];
        canvas.data[index + 3] = color[3];
    }

    private buildFakeProgress(): ProgressData {
        return {
            period: 'Останні 90 днів',
            weight: {current: 77.8, delta: -0.7},
            waist: {current: 86, delta: -3},
            points: [
                {weight: 78.5, waist: 89},
                {weight: 78.2, waist: 88.5},
                {weight: 78.0, waist: 88},
                {weight: 77.6, waist: 87},
                {weight: 77.8, waist: 86},
            ],
            insight: 'Талія зменшується стабільно. Вага майже не змінюється — це хороший сигнал.',
        };
    }
}

type Canvas = {
    width: number;
    height: number;
    data: Uint8Array;
};

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
    const rowLength = width * 4 + 1;
    const raw = Buffer.alloc(rowLength * height);

    for (let y = 0; y < height; y += 1) {
        const rowStart = y * rowLength;
        raw[rowStart] = 0;
        const sourceStart = y * width * 4;
        Buffer.from(rgba.subarray(sourceStart, sourceStart + width * 4)).copy(raw, rowStart + 1);
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        signature,
        createChunk('IHDR', ihdr),
        createChunk('IDAT', deflateSync(raw)),
        createChunk('IEND', Buffer.alloc(0)),
    ]);
}

function createChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);

    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function buildCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
        let crc = index;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[index] = crc >>> 0;
    }

    return table;
}
