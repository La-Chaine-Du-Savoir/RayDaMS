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

