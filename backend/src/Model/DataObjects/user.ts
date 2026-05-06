export interface User {
    id?: number;
    username: string;
    password_hash?: string;
    groups?: number[];      // Optionnel
    roles?: string[];       // Optionnel
    profile_picture_path?: string; // Optionnel
}

export function createUser(data: User): User {
    return {
        id: data.id,
        username: data.username,
        password_hash: data.password_hash || "",
        groups: data.groups || [],
        roles: data.roles || [],
        profile_picture_path: data.profile_picture_path || "/static/default.png",
    };
}

export const isAdmin = (user: User): boolean => {
    return user.roles?.includes("admin") ?? false;
};

export function sanitizeUser(user: User): Omit<User, "password_hash" | "groups" | "profile_picture_path"> {
    const cleanUser = { ...user };
    delete cleanUser.password_hash;
    delete cleanUser.groups;
    delete cleanUser.profile_picture_path;
    return cleanUser;
}