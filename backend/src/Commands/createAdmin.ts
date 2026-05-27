import { z } from "zod";
import userRepository from "../Model/Repository/UserRepository.ts";
import { hashPassword } from "../Services/passwordService.ts";
import type { User } from "../Model/DataObjects/User.ts";

const CreateAdminArgsSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

type CreateAdminArgs = z.infer<typeof CreateAdminArgsSchema>;

function parseArgs(argv: string[]): Partial<CreateAdminArgs> {
  const args: Partial<CreateAdminArgs> = {};

  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;

    const key = current.slice(2) as keyof CreateAdminArgs;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) continue;

    args[key] = value;
    i++;
  }

  return args;
}

function printUsage(): void {
  console.error("Usage: deno task create-admin --username <username> --email <email> --password <password>");
}

async function main(): Promise<void> {
  const parsed = CreateAdminArgsSchema.safeParse(parseArgs(Deno.args));

  if (!parsed.success) {
    console.error("Invalid arguments:", parsed.error.flatten().fieldErrors);
    printUsage();
    Deno.exit(1);
  }

  const { username, email, password } = parsed.data;

  const existingByEmail = await userRepository.getByEmail(email);
  if (existingByEmail) {
    console.error(`Cannot create admin: email already in use (${email}).`);
    Deno.exit(1);
  }

  const existingByUsername = await userRepository.getByUsername(username);
  if (existingByUsername) {
    console.error(`Cannot create admin: username already in use (${username}).`);
    Deno.exit(1);
  }

  const userToCreate: User = {
    username,
    email,
    password_hash: await hashPassword(password),
  };

  const createdUser = await userRepository.create(userToCreate, ["member", "admin"]);
  if (!createdUser.id) {
    throw new Error("User created without id.");
  }

  console.log(`Admin user created successfully: id=${createdUser.id}, username=${createdUser.username}`);
}

if (import.meta.main) {
  await main();
}

