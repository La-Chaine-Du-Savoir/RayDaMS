import { createUser, User } from "../DataObjects/user.ts";
import { GenericRepository } from "./GenericRepository.ts";

type CreateUserInput = Omit<User, "id">;
type UpdateUserInput = Partial<Omit<User, "id">>;

class UserRepository extends GenericRepository<User, CreateUserInput, UpdateUserInput> {
	constructor() {
		super("users");
	}

	protected searchableColumns(): string[] {
		return ["username", "profile_picture_path"];
	}

	protected mapRow(row: Record<string, unknown>): User {
		return createUser({
			id: typeof row.id === "number" ? row.id : undefined,
			username: typeof row.username === "string" ? row.username : "",
			password_hash: typeof row.password_hash === "string" ? row.password_hash : "",
			groups: Array.isArray(row.groups)
				? row.groups.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
				: [],
			roles: Array.isArray(row.roles)
				? row.roles.filter((value): value is string => typeof value === "string")
				: [],
			profile_picture_path: typeof row.profile_picture_path === "string"
				? row.profile_picture_path
				: "/static/default.png",
		});
	}

	protected mapCreateInput(data: CreateUserInput): Record<string, unknown> {
		const normalized = createUser(data);
		return {
			username: normalized.username,
			password_hash: normalized.password_hash,
			groups: normalized.groups,
			roles: normalized.roles ?? [],
			profile_picture_path: normalized.profile_picture_path,
		};
	}

	protected mapUpdateInput(data: UpdateUserInput): Record<string, unknown> {
		const payload: Record<string, unknown> = {};

		if (data.username !== undefined) {
			payload.username = data.username;
		}
		if (data.password_hash !== undefined) {
			payload.password_hash = data.password_hash;
		}
		if (data.groups !== undefined) {
			payload.groups = data.groups;
		}
		if (data.roles !== undefined) {
			payload.roles = data.roles;
		}
		if (data.profile_picture_path !== undefined) {
			payload.profile_picture_path = data.profile_picture_path;
		}

		return payload;
	}

	public async findByUsername(username: string): Promise<User | null> {
		return this.findOneBy("username", username);
	}
}

const userRepository = new UserRepository();

export type { CreateUserInput, UpdateUserInput };
export { UserRepository };
export default userRepository;

