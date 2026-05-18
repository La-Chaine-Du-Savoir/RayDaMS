import cloud from "../../Services/cloud.ts";

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

export interface SanitizedUser extends Omit<User, "password_hash" | "path_profil_picture"> {
    url_profil_picture: string | null;
}

export async function sanitizeUser(user: User): Promise<SanitizedUser> {
    // deno-lint-ignore no-unused-vars
    const { password_hash, path_profil_picture, ...publicUser } = user;

    let url_profil_picture: string | null = null;

    // Si on a un chemin en bd, on demande un ticket à minio
    if (path_profil_picture) {
        try {
            // On génère une URL de lecture valide pendant 1 heure
            url_profil_picture = await cloud.getPresigned(path_profil_picture, 3600, "download");
        } catch (error) {
            console.error("Erreur S3 pour l'avatar de l'utilisateur", user.id, ":", error);
            url_profil_picture = null;
        }
    }

    return {
        ...publicUser,
        roles: user.roles ?? [],
        url_profil_picture
    };
}

