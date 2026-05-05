export function parseJsonFromText(text: string): unknown {
    return JSON.parse(extractJsonString(text));
}

export function parseJsonArrayFromText(text: string): unknown[] | null {
    const json = extractJsonString(text, '[');
    if (!json) {
        return null;
    }

    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed : null;
}

function extractJsonString(text: string, preferredStart?: '[' | '{'): string {
    const source = stripCodeFence(text.trim());
    if (!source) {
        throw new SyntaxError('JSON text is empty');
    }

    if (preferredStart) {
        return extractByBounds(source, preferredStart, closingFor(preferredStart)) ?? '';
    }

    const arrayStart = source.indexOf('[');
    const objectStart = source.indexOf('{');
    const starts = [
        {index: arrayStart, open: '[' as const},
        {index: objectStart, open: '{' as const},
    ].filter((item) => item.index >= 0);

    const first = starts.sort((left, right) => left.index - right.index)[0];
    if (!first) {
        throw new SyntaxError('JSON text does not contain an object or array');
    }

    const json = extractByBounds(source, first.open, closingFor(first.open));
    if (!json) {
        throw new SyntaxError('JSON text is incomplete');
    }

    return json;
}

function extractByBounds(text: string, open: '[' | '{', close: ']' | '}'): string | null {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);

    if (start === -1 || end === -1 || end <= start) {
        return null;
    }

    return text.slice(start, end + 1);
}

function closingFor(open: '[' | '{'): ']' | '}' {
    return open === '[' ? ']' : '}';
}

function stripCodeFence(text: string): string {
    if (!text.startsWith('```')) {
        return text;
    }

    return text
        .replace(/^```[a-zA-Z]*\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
}
