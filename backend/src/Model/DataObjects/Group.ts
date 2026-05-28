import {SanitizedUser, sanitizeUser, User} from "./User.ts";

export interface Group {
    id?: number;
    name: string;
    code?: string;
    created_at?: Date;
}

export type GroupWithUsers = Group & { users: User[] };
export type SanitizedGroupWithUsers = Group & { users: SanitizedUser[] };

export async function sanitizeGroup(group: GroupWithUsers, isAdmin: boolean = false): Promise<SanitizedGroupWithUsers> {
    const sanitizedUsers = await Promise.all(
        group.users.map(user => sanitizeUser(user))
    );

    // Le code n'est envoyé que si c'est un admin
    if (!isAdmin) {
        group.code = undefined;
    }

    return {
        ...group,
        users: sanitizedUsers
    };
}