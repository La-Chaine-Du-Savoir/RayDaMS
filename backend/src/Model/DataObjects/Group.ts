import {SanitizedUser, sanitizeUser, User} from "./User.ts";
import {Game, SanitizedGame, sanitizeGame} from "./Game.ts";

export interface Group {
    id?: number;
    name: string;
    code?: string;
    created_at?: Date;
}

export type GroupWithUsers = Group & { users: User[] };
export type SanitizedGroupWithUsers = Group & { users: SanitizedUser[] };

export type GroupWithUsersAndGames = Group & { users: User[] } & { games: Game[] };
export type SanitizedGroupWithUsersAndGames = Group & { users: SanitizedUser[] } & { games: SanitizedGame[] };

export async function sanitizeGroup(group: GroupWithUsers, isAdmin: boolean = false): Promise<SanitizedGroupWithUsers> {
    const sanitizedUsers = await Promise.all(
        group.users.map(user => sanitizeUser(user))
    );

    // Le code n'est envoy� que si c'est un admin
    if (!isAdmin) {
        group.code = undefined;
    }

    return {
        ...group,
        users: sanitizedUsers
    };
}

export async function sanitizeGroupWithGames(group: GroupWithUsersAndGames, userId: number, isAdmin: boolean = false): Promise<SanitizedGroupWithUsersAndGames> {

    const canEdit = isAdmin || group.users.some(user => user.id === userId);

    const sanitizedUsers = await Promise.all(
        group.users.map(user => sanitizeUser(user))
    );

    let sanitizedGames = [];
    if (group.games && group.games.length > 0) {
         sanitizedGames = await Promise.all(
            group.games.map(async (game: Game) => {
                return await sanitizeGame(game);
            })
        );
    }

    if (!isAdmin) {
        group.code = undefined;
    }

    return {
        ...group,
        users: sanitizedUsers,
        games: sanitizedGames
    };

}
