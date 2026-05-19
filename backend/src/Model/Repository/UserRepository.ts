import { User } from "../DataObjects/User.ts";
import db from "../../Services/database.ts";

const table = "users";

export async function create(user: User, roles: string[] = ["member"]): Promise<User & { roles: string[] }> {
    const result = await db.queryObject<User & { roles: string[] }>(
        `WITH inserted_user AS (
         INSERT INTO ${table}
             (username, email, password_hash, path_profil_picture)
         VALUES
             ($1, $2, $3, $4)
             RETURNING id, username, email, password_hash, path_profil_picture, created_at
             ),
             inserted_roles AS (
         INSERT INTO roles_users (user_id, role_id)
         SELECT iu.id, r.id
         FROM inserted_user iu
             CROSS JOIN roles r
         WHERE r.label = ANY($5)
             RETURNING role_id
             )
        SELECT
            iu.*,
            COALESCE(
                    (
                        SELECT JSON_AGG(r.label)
                        FROM roles r
                                 JOIN roles_users ru ON r.id = ru.role_id
                        WHERE ru.user_id = iu.id
                    ),
                    '[]'::json
            ) as roles
        FROM inserted_user iu`,
        [
            user.username,
            user.email,
            user.password_hash,
            user.path_profil_picture ?? null,
            roles,
        ],
    );

    return result.rows[0];
}

export async function getById(id: number): Promise<User | undefined> {
    const result = await db.queryObject<User & { roles: string[] }>(
        `SELECT
             u.*,
             COALESCE(JSON_AGG(r.label) FILTER (WHERE r.label IS NOT NULL), '[]') as roles
        FROM users u
        LEFT JOIN roles_users ru ON u.id = ru.user_id
        LEFT JOIN roles r ON ru.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id`,
        [id],
    );

    return result.rows[0];
}

export async function getByEmail(email: string): Promise<User | undefined> {
    const result = await db.queryObject<User>(
        `SELECT id, username, email, password_hash, path_profil_picture, created_at
         FROM ${table}
         WHERE email = $1
         LIMIT 1`,
        [email],
    );

    return result.rows[0];
}

export async function getByUsername(username: string): Promise<User | undefined> {
    const result = await db.queryObject<User & { roles: string[] }>(
        `SELECT
             u.*,
             COALESCE(JSON_AGG(r.label) FILTER (WHERE r.label IS NOT NULL), '[]') as roles
         FROM users u
                  LEFT JOIN roles_users ru ON u.id = ru.user_id
                  LEFT JOIN roles r ON ru.role_id = r.id
         WHERE u.username = $1
         GROUP BY u.id`,
        [username],
    );

    return result.rows[0];
}

export async function addRoles(userId: number, roleLabels: string[]): Promise<void> {
    await db.queryObject(
        `INSERT INTO roles_users (user_id, role_id)
         SELECT $1, id
         FROM roles
         WHERE label = ANY($2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleLabels],
    );
}

export async function removeRoles(userId: number, roleLabels: string[]): Promise<void> {
    await db.queryObject(
        `DELETE FROM roles_users
         WHERE user_id = $1
         AND role_id IN (
             SELECT id FROM roles WHERE label = ANY($2)
         )`,
        [userId, roleLabels],
    );
}

const userRepository = { create, getById, getByEmail, getByUsername, addRoles, removeRoles };

export default userRepository;