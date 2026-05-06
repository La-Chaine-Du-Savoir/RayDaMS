export interface User {
    username: string;
    password_hash?: string; // Optionnel
    groups?: string[];      // Optionnel
    profile_picture_path?: string; // Optionnel
}

export function createUser(data: User): User {
    return {
        username: data.username,
        password_hash: data.password_hash || "",
        groups: data.groups || [],
        profile_picture_path: data.profile_picture_path || "/static/default.png",
    };
}

export const isAdmin = (user: User): boolean => {
    return user.groups?.includes("admin") ?? false;
};

export function sanitizeUser(user: User): User {
    // On crée une copie pour ne pas modifier l'original
    const cleanUser = { ...user };
    delete cleanUser.password_hash;
    return cleanUser;
}