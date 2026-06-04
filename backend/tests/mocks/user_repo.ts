import type { User } from "app/Model/DataObjects/User.ts";
import { hashPassword } from "app/Services/passwordService.ts";

const testHash = await hashPassword("password", 4);

const existingUser = {
  id: 1,
  username: "existing",
  email: "existing@example.com",
  password_hash: testHash,
  roles: ["member"],
};

const testUser = {
  id: 2,
  username: "testuser",
  email: "test@example.com",
  password_hash: testHash,
  roles: ["member"],
};

export function getByUsername(username: string) {
  if (username === "testuser") return Promise.resolve(testUser);
  if (username === "existing") return Promise.resolve(existingUser);
  return Promise.resolve(undefined);
}

export function getByEmail(email: string) {
  if (email === "test@example.com") return Promise.resolve(testUser);
  if (email === "existing@example.com") return Promise.resolve(existingUser);
  return Promise.resolve(undefined);
}

export function create(user: User) {
  return Promise.resolve({ ...testUser, ...user, id: 3 });
}

export function getById(id: number) {
  if (id === 1) return Promise.resolve(existingUser);
  if (id === 2) return Promise.resolve(testUser);
  return Promise.resolve(undefined);
}

const userRepository = {
  getByUsername,
  getByEmail,
  create,
  getById,
};

export default userRepository;
