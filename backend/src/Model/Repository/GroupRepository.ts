import { createGroup, Group } from "../DataObjects/group.ts";
import { GenericRepository } from "./GenericRepository.ts";

type CreateGroupInput = Omit<Group, "id">;
type UpdateGroupInput = Partial<Omit<Group, "id">>;

function readNumberArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

class GroupRepository extends GenericRepository<Group, CreateGroupInput, UpdateGroupInput> {
    constructor() {
        super("groups");
    }

    protected searchableColumns(): string[] {
        return ["code", "name"];
    }

    protected mapRow(row: Record<string, unknown>): Group {
        return createGroup({
            id: typeof row.id === "number" ? row.id : undefined,
            code: typeof row.code === "string" ? row.code : "",
            name: typeof row.name === "string" ? row.name : "",
            users: readNumberArray(row.users),
            games: readNumberArray(row.games),
        });
    }

    protected mapCreateInput(data: CreateGroupInput): Record<string, unknown> {
        const normalized = createGroup(data);
        return {
            code: normalized.code,
            name: normalized.name,
            users: normalized.users,
            games: normalized.games,
        };
    }

    protected mapUpdateInput(data: UpdateGroupInput): Record<string, unknown> {
        const payload: Record<string, unknown> = {};

        if (data.code !== undefined) {
            payload.code = data.code.trim();
        }
        if (data.name !== undefined) {
            payload.name = data.name.trim();
        }
        if (data.users !== undefined) {
            payload.users = data.users;
        }
        if (data.games !== undefined) {
            payload.games = data.games;
        }

        return payload;
    }

    public async findByCode(code: string): Promise<Group | null> {
        return this.findOneBy("code", code.trim());
    }
}

const groupRepository = new GroupRepository();

export type { CreateGroupInput, UpdateGroupInput };
export { GroupRepository };
export default groupRepository;

