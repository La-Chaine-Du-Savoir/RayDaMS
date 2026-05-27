import db from "../Services/database.ts";

async function pruneDatabase(): Promise<void> {
    try {
        const environment = Deno.env.get("ENVIRONMENT");
        if (!environment) {
            console.error("ENVIRONMENT variable not set, aborting to prevent accidental data deletion.");
            Deno.exit(1);
        }
        if (environment === "production") {
            console.error("Cannot run db:prune in production environment.");
            console.error("This command is only for development/testing purposes.");
            Deno.exit(1);
        }

        console.log("Starting database prune operation ...");
        console.log("This will DELETE all user data");

        const confirmEnv = Deno.env.get("CONFIRM_PRUNE");
        if (confirmEnv !== "true") {
            console.log("\nTo confirm this operation, set CONFIRM_PRUNE=true");
            console.log("   Example: CONFIRM_PRUNE=true deno task db:prune\n");
            Deno.exit(0);
        }

        console.log("\nDeleting data in correct order (respecting foreign keys)...\n");

        const deletionOrder = [
            { table: "games", desc: "Games" },
            { table: "users_groups", desc: "User-Group associations" },
            { table: "roles_users", desc: "User-Role associations" },
            { table: "users", desc: "Users" },
            { table: "groups", desc: "Groups" },
        ];

        for (const { table, desc } of deletionOrder) {
            try {
                const result = await db.queryArray(`DELETE FROM ${table}`);
                const rowCount = result.rowCount || 0;
                console.log(`Deleted from ${desc.padEnd(30)} (${rowCount} rows removed)`);
            } catch (err) {
                console.error(`Error deleting from ${desc}:`, err instanceof Error ? err.message : String(err));
                throw err;
            }
        }

        console.log("\nDatabase prune completed successfully!");
        console.log("Note: Roles (admin, member) have been preserved.\n");

    } catch (err) {
        console.error("Error during database prune:", err instanceof Error ? err.message : String(err));
        Deno.exit(1);
    } finally {
        await db.end();
    }
}

if (import.meta.main) {
    await pruneDatabase();
}

