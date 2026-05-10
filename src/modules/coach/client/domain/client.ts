export const CLIENT_STATUS_ACTIVE = 'ACTIVE';
export const CLIENT_STATUS_ONLINE = 'ONLINE';
export const CLIENT_STATUS_INACTIVE = 'INACTIVE';
export const CLIENT_GENDER_FEMALE = 'F';
export const CLIENT_GENDER_MALE = 'M';
export const CLIENT_GENDER_UNKNOWN = 'U';

export const CLIENT_STATUSES = [
    CLIENT_STATUS_ACTIVE,
    CLIENT_STATUS_ONLINE,
    CLIENT_STATUS_INACTIVE,
] as const;

export const CLIENT_GENDERS = [
    CLIENT_GENDER_FEMALE,
    CLIENT_GENDER_MALE,
    CLIENT_GENDER_UNKNOWN,
] as const;

export type ClientStatus = typeof CLIENT_STATUSES[number];
export type ClientGender = typeof CLIENT_GENDERS[number];

export class ClientProfile {
    id = 0;
    coachId = 0;
    firstName = '';
    lastName = '';
    status: ClientStatus = CLIENT_STATUS_ACTIVE;
    gender: ClientGender = CLIENT_GENDER_UNKNOWN;
    lang = '';
    birthday = '';
    createdAt = '';
    lastActivity?: string | null;
    goals?: string | null;
    notes?: string | null;

    constructor(init?: Partial<ClientProfile>) {
        Object.assign(this, init);
    }
}

export interface ClientListRequest {
    coachId: number;
    page: number;
    limit: number;
}

export interface ClientListResult {
    items: ClientProfile[];
    total: number | null;
}

export interface ClientCreateInput {
    firstName: string;
    lastName: string;
    status: ClientStatus;
    gender: ClientGender;
    lang: string;
    birthday: string;
    goals?: string | null;
    notes?: string | null;
}

export interface ClientUpdateInput {
    firstName?: string;
    lastName?: string;
    status?: ClientStatus;
    gender?: ClientGender;
    lang?: string;
    birthday?: string;
    goals?: string | null;
    notes?: string | null;
}
