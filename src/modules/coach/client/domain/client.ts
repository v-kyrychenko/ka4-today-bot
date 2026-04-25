export const CLIENT_STATUS_ACTIVE = 'ACTIVE';
export const CLIENT_STATUS_ONLINE = 'ONLINE';
export const CLIENT_STATUS_INACTIVE = 'INACTIVE';

export const CLIENT_STATUSES = [
    CLIENT_STATUS_ACTIVE,
    CLIENT_STATUS_ONLINE,
    CLIENT_STATUS_INACTIVE,
] as const;

export type ClientStatus = typeof CLIENT_STATUSES[number];

export class ClientItem {
    id = 0;
    coachId = 0;
    firstName = '';
    lastName = '';
    status: ClientStatus = CLIENT_STATUS_ACTIVE;
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
    status: ClientStatus;
    lang: string;
    birthday: string;
    goals?: string | null;
    notes?: string | null;
}

export interface ClientUpdateInput {
    firstName?: string;
    lastName?: string;
    status?: ClientStatus;
    lang?: string;
    birthday?: string;
    goals?: string | null;
    notes?: string | null;
}
