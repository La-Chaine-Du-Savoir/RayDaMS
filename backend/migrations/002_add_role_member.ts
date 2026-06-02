import type { MigrationExecutor } from "../src/Commands/runMigrations.ts";

const migration = {
  version: 2,
  name: "add role member",
  async up(db: MigrationExecutor): Promise<void> {
    // Insertion du role member
    await db.queryArray(`
            INSERT INTO roles (label) VALUES
                ('member')
            ON CONFLICT (label) DO NOTHING
        `);
  },
};

export default migration;
