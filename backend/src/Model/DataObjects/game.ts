export interface Game {
    id?: number;
    name: string;
    description?: string; //Optionnel
    thumbnail_path?: string; // Optionnel
    author: number;
    game_path?: string; // Optionnel
}

export function createGame(data: Game): Game {
    return {
        id: data.id,
        name: data.name.trim(),
        description: data.description ?? "",
        thumbnail_path: data.thumbnail_path ?? "/static/default-game.png",
        author: data.author,
        game_path: data.game_path ?? "",
    };
}

export function isGameOwnedBy(game: Game, userId: number): boolean {
    return game.author === userId;
}

export function sanitizeGame(game: Game): Omit<Game, 'game_path' | 'thumbnail_path'>{
    const cleanGame = { ...game };
    delete cleanGame.game_path;
    delete cleanGame.thumbnail_path;
    return cleanGame;
}
