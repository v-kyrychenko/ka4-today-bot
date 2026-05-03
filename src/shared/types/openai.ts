export const DEFAULT_MODEL = 'gpt-4o-mini';
export const DEFAULT_TEMPERATURE =  0.8;

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

export interface OpenAiCreateResponseInput {
    systemPrompt: string;
    userPrompt: string;
    vectorStoreIds?: string[];
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
    incomplete_details?: Object;

    constructor(init?: Partial<OpenAiResponseDetails>) {
        Object.assign(this, init);
        this.output = (init?.output ?? []).map((item) => new OpenAiOutputMessage(item));
    }
}
