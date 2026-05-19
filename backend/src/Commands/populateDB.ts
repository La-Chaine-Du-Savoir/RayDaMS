import db from "../Services/database.ts";
import userRepository from "../Model/Repository/UserRepository.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import { hashPassword } from "../Services/passwordService.ts";
import type { User } from "../Model/DataObjects/User.ts";
import type { Group } from "../Model/DataObjects/Group.ts";

async function populateDatabase(): Promise<void> {
    try {
        console.log("Starting database population...");

        // Create test users
        console.log("Creating test users...");
        const users: User[] = [];

        const testUsers = [
            { username: "admin1", email: "admin1@test.com", password: "Lapin12!" },
            { username: "admin2", email: "admin2@test.com", password: "Lapin12!" },
            { username: "Thib", email: "chimpanzinibananini@test.com", password: "Lapin12!" },
            { username: "Toine", email: "tungtungtungsahur@test.com", password: "Lapin12!" },
            { username: "Nosman", email: "tralerotralala@test.com", password: "Lapin12!" },
        ];

        for (const testUser of testUsers) {
            try {
                const existing = await userRepository.getByEmail(testUser.email);
                if (existing) {
                    console.log(`User ${testUser.username} already exists, skipping...`);
                    users.push(existing);
                    continue;
                }

                const user: User = {
                    username: testUser.username,
                    email: testUser.email,
                    password_hash: await hashPassword(testUser.password),
                };

                const isAdmin = testUser.username.includes("admin");
                const created = await userRepository.create(user, isAdmin ? ["member", "admin"] : ["member"]);
                if (created.id) {
                    users.push(created);
                    console.log(`Created user: ${testUser.username} (id: ${created.id})`);
                }
            } catch (err) {
                console.error(`Error creating user ${testUser.username}:`, err);
            }
        }

        // Create test groups
        console.log("Creating test groups...");
        const groups: Group[] = [];

        const testGroups = [
            { name: "Chaine du savoir", code: "SAVOIR0001" },
            { name: "Skibidi Land", code: "SKIBIDI001" },
            { name: "TDB Masters", code: "TDB0000001" },
        ];

        for (const testGroup of testGroups) {
            try {
                const existing = await groupRepository.getByCode(testGroup.code);
                if (existing) {
                    console.log(`Group ${testGroup.name} already exists, skipping...`);
                    groups.push(existing);
                    continue;
                }

                const created = await groupRepository.create(testGroup);
                if (created.id) {
                    groups.push(created);
                    console.log(`Created group: ${testGroup.name} (id: ${created.id}, code: ${testGroup.code})`);
                }
            } catch (err) {
                console.error(`Error creating group ${testGroup.name}:`, err);
            }
        }

        // Add users to groups
        console.log("Adding users to groups...");
        if (users.length > 1 && groups.length > 0) {
            try {
                await groupRepository.addUserToGroup(groups[0].id!, users[1].id!);
                await groupRepository.addUserToGroup(groups[0].id!, users[2].id!);
                console.log(`Added users to ${groups[0].name}`);

                await groupRepository.addUserToGroup(groups[1].id!, users[1].id!);
                await groupRepository.addUserToGroup(groups[1].id!, users[3].id!);
                console.log(`Added users to ${groups[1].name}`);

                await groupRepository.addUserToGroup(groups[2].id!, users[2].id!);
                console.log(`Added users to ${groups[2].name}`);
            } catch (err) {
                console.error("Error adding users to groups:", err);
            }
        }

        console.log("Database population completed successfully!");
    } catch (err) {
        console.error("Error during database population:", err);
        Deno.exit(1);
    } finally {
        await db.end();
    }
}

if (import.meta.main) {
    await populateDatabase();
}

