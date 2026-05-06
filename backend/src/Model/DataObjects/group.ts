export interface Group {
    id?: number;
    code: string;
    name: string;
    users?: number[];
    games?: number[];
}

export function createGroup(data: Group): Group {
    return {
        id: data.id,
        code: data.code.trim(),
        name: data.name.trim(),
        users: data.users ?? [],
        games: data.games ?? [],
    };
}

export function isUserInGroup(group: Group, userId: number): boolean {
    return group.users.includes(userId);
}

export function isGameInGroup(group: Group, gameId: number): boolean {
    return group.games.includes(gameId);
}

export function sanitizeGroup(group: Group): Omit<Group, 'users' | 'games'> {
    const cleanGroup = { ...group };
    delete cleanGroup.users;
    delete cleanGroup.games;
    return cleanGroup;
}
