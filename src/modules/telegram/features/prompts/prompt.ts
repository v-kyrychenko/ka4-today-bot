export class PromptDictSystem {
    id = 0;
    key = '';
    prompts: Record<string, string> = {};

    constructor(init?: Partial<PromptDictSystem>) {
        Object.assign(this, init);
        this.prompts = init?.prompts ?? {};
    }
}

export class PromptDict {
    id = 0;
    key = '';
    prompts: Record<string, string> = {};
    vectorStoreIds: string[] = [];
    systemPrompt: PromptDictSystem | null = null;

    constructor(init?: Partial<PromptDict>) {
        Object.assign(this, init);
        this.prompts = init?.prompts ?? {};
        this.vectorStoreIds = init?.vectorStoreIds ?? [];
        this.systemPrompt = init?.systemPrompt ? new PromptDictSystem(init.systemPrompt) : null;
    }
}
