import { createGame, Game } from "../DataObjects/game.ts";
import { GenericRepository } from "./GenericRepository.ts";

type CreateGameInput = Omit<Game, "id">;
type UpdateGameInput = Partial<Omit<Game, "id">>;

class GameRepository extends GenericRepository<Game, CreateGameInput, UpdateGameInput> {
    constructor() {
        super("games");
    }

    protected searchableColumns(): string[] {
        return ["name", "description"];
    }

    protected mapRow(row: Record<string, unknown>): Game {
        return createGame({
            id: typeof row.id === "number" ? row.id : undefined,
            name: typeof row.name === "string" ? row.name : "",
            description: typeof row.description === "string" ? row.description : "",
            thumbnail_path: typeof row.thumbnail_path === "string"
                ? row.thumbnail_path
                : "/static/default-game.png",
            author: typeof row.author === "number" ? row.author : 0,
            game_path: typeof row.game_path === "string" ? row.game_path : "",
        });
    }

    protected mapCreateInput(data: CreateGameInput): Record<string, unknown> {
        const normalized = createGame(data);
        return {
            name: normalized.name,
            description: normalized.description,
            thumbnail_path: normalized.thumbnail_path,
            author: normalized.author,
            game_path: normalized.game_path,
        };
    }

    protected mapUpdateInput(data: UpdateGameInput): Record<string, unknown> {
        const payload: Record<string, unknown> = {};

        if (data.name !== undefined) {
            payload.name = data.name.trim();
        }
        if (data.description !== undefined) {
            payload.description = data.description;
        }
        if (data.thumbnail_path !== undefined) {
            payload.thumbnail_path = data.thumbnail_path;
        }
        if (data.author !== undefined) {
            payload.author = data.author;
        }
        if (data.game_path !== undefined) {
            payload.game_path = data.game_path;
        }

        return payload;
    }

    public async findByName(name: string): Promise<Game | null> {
        return this.findOneBy("name", name.trim());
    }

    public async findByAuthorId(authorId: number): Promise<Game[]> {
        return this.findManyBy("author", authorId);
    }
}

const gameRepository = new GameRepository();

export type { CreateGameInput, UpdateGameInput };
export { GameRepository };
export default gameRepository;


