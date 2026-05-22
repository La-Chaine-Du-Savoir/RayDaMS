import type { MigrationExecutor } from "../src/Commands/runMigrations.ts";

const migration = {
    version: 3,
    name: "add game storage paths and status enum",
    async up(db: MigrationExecutor): Promise<void> {
        await db.queryArray(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'build_status') THEN
                    CREATE TYPE build_status AS ENUM ('pending', 'running', 'success', 'failed');
                END IF;
            END
            $$;
        `);

        await db.queryArray(`
            TRUNCATE TABLE games CASCADE;
        `);

        await db.queryArray(`
            ALTER TABLE games
                ADD COLUMN IF NOT EXISTS path_sources VARCHAR(255) NOT NULL,
                ADD COLUMN IF NOT EXISTS path_js VARCHAR(255),
                ADD COLUMN IF NOT EXISTS path_wasm VARCHAR(255),
                ADD COLUMN IF NOT EXISTS path_data VARCHAR(255),
                ADD COLUMN IF NOT EXISTS status build_status NOT NULL DEFAULT 'pending';
        `);
    },
};

export default migration;