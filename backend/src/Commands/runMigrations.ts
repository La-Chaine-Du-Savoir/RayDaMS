import db from "../Services/database.ts";

export interface MigrationExecutor {
  queryArray<T = unknown[]>(
    query: string | TemplateStringsArray,
    ...args: unknown[]
  ): Promise<{ rows: T[] }>;
  queryObject<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string | TemplateStringsArray,
    ...args: unknown[]
  ): Promise<{ rows: T[] }>;
}

interface MigrationModule {
  version?: number;
  name?: string;
  up(executor: MigrationExecutor): Promise<void> | void;
}

const MIGRATION_LOCK_KEY = 7845123;
const MIGRATIONS_DIRECTORY = new URL("../../migrations/", import.meta.url);

interface LoadedMigration {
  version: number;
  filename: string;
  name: string;
  up: (executor: MigrationExecutor) => Promise<void> | void;
}

function parseMigrationFilename(
  filename: string,
): { version: number; name: string } {
  const match = filename.match(/^(\d+)(?:[_-](.+))?\.ts$/i);
  if (!match) {
    throw new Error(
      `Migration file name must start with a numeric version and end with .ts: ${filename}`,
    );
  }

  const version = Number.parseInt(match[1], 10);
  if (!Number.isFinite(version)) {
    throw new Error(`Invalid migration version in file name: ${filename}`);
  }

  return {
    version,
    name: match[2]?.replace(/[_-]+/g, " ") ?? filename.slice(0, -3),
  };
}

function resolveMigrationModule(
  module: Partial<MigrationModule> & { default?: unknown },
): Partial<MigrationModule> {
  if (typeof module.default === "function") {
    return { up: module.default as MigrationModule["up"] };
  }

  if (module.default && typeof module.default === "object") {
    return module.default as MigrationModule;
  }

  return module;
}

async function ensureMigrationTableExists(
  client: MigrationExecutor,
): Promise<void> {
  await client.queryArray(
    `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `,
  );
}

async function loadMigrations(): Promise<LoadedMigration[]> {
  const migrations: LoadedMigration[] = [];

  for await (const entry of Deno.readDir(MIGRATIONS_DIRECTORY)) {
    if (
      !entry.isFile || !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".d.ts")
    ) {
      continue;
    }

    const parsed = parseMigrationFilename(entry.name);
    const moduleUrl = new URL(entry.name, MIGRATIONS_DIRECTORY);
    const importedModule = await import(moduleUrl.href) as
      & Partial<MigrationModule>
      & { default?: unknown };
    const migrationModule = resolveMigrationModule(importedModule);

    if (typeof migrationModule.up !== "function") {
      throw new Error(
        `Migration file ${entry.name} must export an up() function`,
      );
    }

    migrations.push({
      version: migrationModule.version ?? parsed.version,
      filename: entry.name,
      name: migrationModule.name ?? parsed.name,
      up: migrationModule.up.bind(migrationModule),
    });
  }

  migrations.sort((left, right) =>
    left.version - right.version || left.filename.localeCompare(right.filename)
  );
  return migrations;
}

export async function runMigrations(): Promise<void> {
  const client = db;

  try {
    await ensureMigrationTableExists(client);
    await client.queryArray("SELECT pg_advisory_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    try {
      const { rows: appliedRows } = await client.queryObject<
        { version: number }
      >(
        `SELECT version
                FROM schema_migrations`,
      );
      const appliedVersions = new Set(
        appliedRows.map((row) => Number(row.version)),
      );
      const migrations = await loadMigrations();
      const pendingMigrations = migrations.filter((migration) =>
        !appliedVersions.has(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log("No pending migrations");
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);

      for (const migration of pendingMigrations) {
        const transaction = client.createTransaction(
          `migration_${migration.version}`,
        );
        await transaction.begin();

        try {
          console.log(
            `Applying migration ${migration.version}: ${migration.name}`,
          );
          await migration.up(transaction);
          await transaction.queryArray(
            "INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)",
            [migration.version, migration.filename],
          );
          await transaction.commit();
          console.log(
            `Applied migration ${migration.version}: ${migration.name}`,
          );
        } catch (error) {
          await transaction.rollback().catch(() => undefined);
          throw error;
        }
      }
    } finally {
      await client.queryArray("SELECT pg_advisory_unlock($1)", [
        MIGRATION_LOCK_KEY,
      ]);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  await runMigrations();
}
