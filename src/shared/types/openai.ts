export type OpenAiResponseStatus =
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'requires_action'
    | 'failed'
    | 'cancelled';

export interface OpenAiRequiredAction {
    type: string;
}

export interface OpenAiOutputTextPart {
    type: 'output_text';
    text: string;
}

export interface OpenAiOutputPart {
    type: string;
    text?: string;
}

export class OpenAiOutputMessage {
    role = '';
    created_at = 0;
    content: Array<OpenAiOutputPart | OpenAiOutputTextPart> = [];

    constructor(init?: Partial<OpenAiOutputMessage>) {
        Object.assign(this, init);
        this.content = init?.content ?? [];
    }
}

export class OpenAiResponseDetails {
    id = '';
    status: OpenAiResponseStatus = 'in_progress';
    output: OpenAiOutputMessage[] = [];
    required_action?: OpenAiRequiredAction;

    constructor(init?: Partial<OpenAiResponseDetails>) {
        Object.assign(this, init);
        this.output = (init?.output ?? []).map((item) => new OpenAiOutputMessage(item));
    }
}
