import { Game } from "../DataObjects/Game.ts";
import db from "../../Services/database.ts";

const table = "games";

/**
 * Crée un jeu en base de données.
 * Retourne le jeu nouvellement créé avec son ID et sa date de création.
 */
export async function create(game: Partial<Game> & { author: number }): Promise<Game> {
    const result = await db.queryObject<Game>(
        `INSERT INTO ${table}
         (name, description, group_id, url_trailer, author, path_sources, sources_uploaded, path_js, path_wasm, path_data, status)
         VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, name, description, group_id, url_trailer, author, path_sources, sources_uploaded, path_js, path_wasm, path_data, status, created_at`,
        [
            game.name,
            game.description ?? null,
            game.group_id,
            game.url_trailer ?? null,
            game.author, // Ajout indispensable pour valider la contrainte NOT NULL de la BDD
            game.path_sources ?? '',
            game.sources_uploaded ?? false,
            game.path_js ?? '',
            game.path_wasm ?? '',
            game.path_data ?? '',
            game.status ?? 'pending'
        ],
    );

    return result.rows[0];
}

/**
 * Récupère un jeu par son ID.
 */
export async function getById(id: string): Promise<Game | undefined> {
    const result = await db.queryObject<Game>(
        `SELECT * FROM games WHERE id = $1`,
        [id],
    );

    return result.rows[0];
}

/**
 * Récupère l'intégralité des jeux enregistrés, triés du plus récent au plus ancien.
 */
export async function getAllGames(): Promise<Game[]> {
    const result = await db.queryObject<Game>(
        `SELECT * FROM games ORDER BY created_at DESC`
    );

    return result.rows;
}

/**
 * Récupère la liste des jeux appartenant à un groupe spécifique.
 */
export async function getGamesByGroupId(groupId: number): Promise<Game[]> {
    const result = await db.queryObject<Game>(
        `SELECT * FROM games
         WHERE group_id = $1
         ORDER BY created_at DESC`,
        [groupId]
    );

    return result.rows;
}

/**
 * Supprime définitivement un jeu de la base de données.
 */
export async function deleteGame(id: string): Promise<boolean> {
    const result = await db.queryObject(
        `DELETE FROM games WHERE id = $1`,
        [id]
    );

    return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Met à jour les champs d'un jeu.
 */
export async function updateGame(id: string, updates: Partial<Omit<Game, "id" | "created_at">> & { thumbnail_path?: string }): Promise<Game | undefined> {
    const result = await db.queryObject<Game>(
        `UPDATE games
         SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             url_trailer = COALESCE($3, url_trailer),
             status = COALESCE($4, status),
             sources_uploaded = COALESCE($5, sources_uploaded),
              path_sources = COALESCE($6, path_sources),
              path_js = COALESCE($7, path_js),
              path_wasm = COALESCE($8, path_wasm),
              path_data = COALESCE($9, path_data),
              path_screenshot = COALESCE($10, path_screenshot),
              group_id = COALESCE($11, group_id),
              thumbnail_path = COALESCE($12, thumbnail_path)
          WHERE id = $13
             RETURNING *`,
        [
            updates.name ?? null,
            updates.description ?? null,
            updates.url_trailer ?? null,
            updates.status ?? null,
            updates.sources_uploaded ?? null,
            updates.path_sources ?? null,
            updates.path_js ?? null,
            updates.path_wasm ?? null,
            updates.path_data ?? null,
            updates.path_screenshot ?? null,
            updates.group_id ?? null,
            updates.thumbnail_path ?? null,
            id
        ]
    );

    return result.rows[0];
}

const gameRepository = {
    create,
    getById,
    getAllGames,
    getGamesByGroupId,
    deleteGame,
    updateGame
};

export default gameRepository;