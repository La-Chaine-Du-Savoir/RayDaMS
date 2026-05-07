import type { MigrationExecutor } from "../src/Migrations/types.ts";

const migration = {
    version: 1,
    name: "initial schema",
    async up(db: MigrationExecutor): Promise<void> {
        // Table USERS
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                path_profil_picture VARCHAR(255)
            )
        `);

        // Table GROUPS
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                code VARCHAR(10)
            )
        `);

        // Table ROLES
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                label VARCHAR(50) NOT NULL UNIQUE
            )
        `);

        // Table GAMES
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                name VARCHAR(128) NOT NULL,
                thumbnail_path VARCHAR(255),
                path_screenshot VARCHAR(255),
                url_trailer VARCHAR(255),
                description TEXT,
                author INT NOT NULL,
                group_id INT NOT NULL,
                FOREIGN KEY (author) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            )
        `);

        // Table de jointure USERS_GROUPS
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS users_groups (
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                group_id INT REFERENCES groups(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, group_id)
            )
        `);

        // Table de jointure ROLES_USERS
        await db.queryArray(`
            CREATE TABLE IF NOT EXISTS roles_users (
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                role_id INT REFERENCES roles(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, role_id)
            )
        `);

        // Insertion des roles
        await db.queryArray(`
            INSERT INTO roles (label) VALUES
                ('admin')
            ON CONFLICT (label) DO NOTHING
        `)
    },
};

export default migration;