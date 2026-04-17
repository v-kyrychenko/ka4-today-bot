export class ClientItem {
    id = 0;
    coachId = 0;
    firstName = '';
    lastName = '';
    status = '';
    lang = '';
    birthday = '';
    createdAt = '';
    lastActivity?: string | null;
    goals?: string | null;
    notes?: string | null;

    constructor(init?: Partial<ClientItem>) {
        Object.assign(this, init);
    }
}

export interface ClientListRequest {
    coachId: number;
    page: number;
    limit: number;
}

export interface ClientListResult {
    items: ClientItem[];
    total: number | null;
}

export interface ClientCreateInput {
    firstName: string;
    lastName: string;
    status: string;
    lang: string;
    birthday: string;
    goals?: string | null;
    notes?: string | null;
}

export interface ClientUpdateInput {
    firstName?: string;
    lastName?: string;
    status?: string;
    lang?: string;
    birthday?: string;
    goals?: string | null;
    notes?: string | null;
}
