import { User } from "../DataObjects/User.ts";
import db from "../../Config/database.ts";

class UserRepository {
    private table = "users";

    async create(user: User): Promise<User> {
        const result = await db.queryObject<User>(
            `INSERT INTO ${this.table} 
                (username, email, password_hash, path_profil_picture)
             VALUES 
                ($1, $2, $3, $4)
             RETURNING id, username, email, password_hash, path_profil_picture, created_at`,
            [
                user.username,
                user.email,
                user.password_hash,
                user.path_profil_picture ?? null
            ]
        );

        return result.rows[0];
    }

    async getById(id: number): Promise<User | undefined> {
        const result = await db.queryObject<User & { roles: string[] }>(
            `SELECT
                 u.*,
                 COALESCE(JSON_AGG(r.label) FILTER (WHERE r.label IS NOT NULL), '[]') as roles
            FROM users u
            LEFT JOIN roles_users ru ON u.id = ru.user_id
            LEFT JOIN roles r ON ru.role_id = r.id
            WHERE u.id = $1
            GROUP BY u.id`,
            [id]
        );

        return result.rows[0];
    }

    async addRoles(userId: number, roleLabels: string[]): Promise<void> {
        await db.queryObject(`
            INSERT INTO roles_users (user_id, role_id)
            SELECT $1, id
            FROM roles
            WHERE label = ANY($2)
                ON CONFLICT (user_id, role_id) DO NOTHING
        `, [userId, roleLabels]);
    }

    async removeRoles(userId: number, roleLabels: string[]): Promise<void> {
        await db.queryObject(`
            DELETE FROM roles_users 
            WHERE user_id = $1 
            AND role_id IN (
                SELECT id FROM roles WHERE label = ANY($2)
            )
        `, [userId, roleLabels]);
    }
}

const userRepository = new UserRepository();

export default userRepository;