export interface User {
    id?: number;
    username: string;
    email: string;
    password_hash: string;
    created_at?: Date;
    path_profil_picture?: string;
    roles?: string[];
}

function isAdmin(user: User): boolean {
    return user.roles?.includes("admin") ?? false;
}

export function sanitizeUser(user: User): Omit<User, "password_hash" | "path_profil_picture"> {
    // deno-lint-ignore no-unused-vars
    const { password_hash, path_profil_picture, ...publicUser } = user;

    return {
        ...publicUser,
        roles: user.roles ?? []
    };
}

