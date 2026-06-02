import { Context, Router } from "oak";
import { connect, type XIdInput } from "redis";
import { z } from "zod";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import cloud from "../Services/cloud.ts";
import redisClient from "../Services/redis.ts";
import config from "../Config/config.ts";
import { Game, sanitizeGame } from "../Model/DataObjects/Game.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import gameRepository from "../Model/Repository/GameRepository.ts";
import formDataMiddleware from "../Middlewares/formDataMiddleware.ts";

const router = new Router({ prefix: "/games" });

const ACCEPTED_IMAGE_TYPES = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;

const CreateGameSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  group_id: z.number().int().positive(),
  url_trailer: z.string().optional().nullable(),
  thumbnail: z
    .instanceof(File, { message: "La thumbnail doit être un fichier valide." })
    .optional()
    .nullable()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, {
      message: "L'image est trop lourde. Limite maximale : 5 Mo.",
    })
    .refine((file) => {
      if (!file) return true;
      const mime = (file.type || "").split("/").pop() || "";
      return ACCEPTED_IMAGE_TYPES.includes(mime.toLowerCase());
    }, {
      message:
        "Format invalide. Seuls les formats .jpg, .jpeg, .png et .webp sont acceptés.",
    }),
  screenshot: z
    .instanceof(File, { message: "La Screenshot doit être un fichier valide." })
    .optional()
    .nullable()
    .refine((file) => !file || file.size <= MAX_SCREENSHOT_SIZE, {
      message: "L'image est trop lourde. Limite maximale : 10 Mo.",
    })
    .refine((file) => {
      if (!file) return true;
      const mime = (file.type || "").split("/").pop() || "";
      return ACCEPTED_IMAGE_TYPES.includes(mime.toLowerCase());
    }, {
      message:
        "Format invalide. Seuls les formats .jpg, .jpeg, .png et .webp sont acceptés.",
    }),
});

const UpdateGameSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  url_trailer: z.string().optional().nullable(),
  thumbnail: z.instanceof(File).optional().nullable()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, {
      message: "Thumbnail max 5 Mo.",
    })
    .refine((file) => {
      if (!file) return true;
      return ACCEPTED_IMAGE_TYPES.includes(
        (file.type || "").split("/").pop()?.toLowerCase() || "",
      );
    }, { message: "Format thumbnail invalide." }),
  screenshot: z.instanceof(File).optional().nullable()
    .refine((file) => !file || file.size <= MAX_SCREENSHOT_SIZE, {
      message: "Screenshot max 10 Mo.",
    })
    .refine((file) => {
      if (!file) return true;
      return ACCEPTED_IMAGE_TYPES.includes(
        (file.type || "").split("/").pop()?.toLowerCase() || "",
      );
    }, { message: "Format screenshot invalide." }),
});

type CreateGameData = z.infer<typeof CreateGameSchema>;

/**
 * Create a new game entry and return a presigned upload URL where the client
 * can upload the ZIP source archive. The server stores a generated S3 key in
 * `path_sources` (non-null) and the presigned URL points to that key for an upload.
 */
router.post("/", formDataMiddleware, authMiddleware, async (ctx: Context) => {
  const body = await ctx.request.body.formData();

  const name = body.get("name") as string | null;
  const description = body.get("description") as string | null;
  const rawGroupId = body.get("group_id") as string | null;
  const url_trailer = body.get("url_trailer") as string | null;
  const thumbnailFile = body.get("thumbnail") as File | null;
  const screenshotFile = body.get("screenshot") as File | null;

  const payload = {
    name: name,
    description: description,
    group_id: rawGroupId ? Number(rawGroupId) : undefined,
    url_trailer: url_trailer,
    thumbnail: thumbnailFile,
    screenshot: screenshotFile,
  };

  let validatedData: CreateGameData;
  try {
    validatedData = CreateGameSchema.parse(payload);
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: error,
    };
    return;
  }

  const group = await groupRepository.getById(validatedData.group_id);
  if (!group) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: "Invalid group ID",
    };
    return;
  } else if (
    group.users.find((u) => u.id === ctx.state.user.id) === undefined &&
    ctx.state.user.roles.includes("admin") === false
  ) {
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      error: "You must be a member of the group to add a game to it",
    };
    return;
  }

  let game: Game;
  try {
    game = await gameRepository.create({
      name: validatedData.name,
      description: validatedData.description || undefined,
      group_id: group.id,
      url_trailer: validatedData.url_trailer || undefined,
      author: ctx.state.user.id,
    });
  } catch (_err) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Failed to create game",
    };
    return;
  }

  const updates: Record<string, string> = {};

  updates["path_sources"] = `games/${game.id}/sources.zip`;

  if (validatedData.thumbnail) {
    const extension = validatedData.thumbnail.type.split("/")[1];
    const thumbnail_path = `games/${game.id}/thumb.${extension}`;

    try {
      await cloud.upload(
        thumbnail_path,
        new Uint8Array(await validatedData.thumbnail.arrayBuffer()),
        validatedData.thumbnail.type,
      );
      updates["thumbnail_path"] = thumbnail_path;
    } catch (err) {
      console.error("Error while uploading thumbnail", err);
    }
  }

  if (validatedData.screenshot) {
    const extension = validatedData.screenshot.type.split("/")[1];
    const screenshot_path = `games/${game.id}/screenshot.${extension}`;

    try {
      await cloud.upload(
        screenshot_path,
        new Uint8Array(await validatedData.screenshot.arrayBuffer()),
        validatedData.screenshot.type,
      );
      updates["path_screenshot"] = screenshot_path;
    } catch (err) {
      console.error("Error while uploading screenshot", err);
    }
  }

  try {
    game = await gameRepository.updateGame(String(game.id), updates) ?? game;
  } catch (err) {
    console.error("Error while updating game metadata", err);
  }

  let upload_request = null;
  try {
    upload_request = await cloud.getPresignedPostForm(
      `games/${game.id}/sources.zip`,
      700 * 1024 * 1024,
      ["application/zip"],
    );
  } catch (err) {
    console.error("Error generating initial upload request", err);
  }

  ctx.response.status = 201;
  ctx.response.body = {
    success: true,
    message: upload_request
      ? "Game created; upload your ZIP to the returned URL"
      : "Game created; failed to generate upload URL, use GET /games/:gameId/upload-request",
    data: {
      game: await sanitizeGame(game),
      upload_request,
    },
  };
});

router.patch("/:gameId", formDataMiddleware, authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  if (!gameId) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Game ID is required" };
    return;
  }

  const game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Game not found" };
    return;
  }

  // Vérification des droits (Auteur ou Admin)
  const isAuthor = game.author === ctx.state.user.id;
  const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;
  if (!isAuthor && !isAdmin) {
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      error: "You must be the game author or an admin to edit this game",
    };
    return;
  }

  const body = await ctx.request.body.formData();

  // On ne récupère que ce qui est envoyé
  const payload: Record<string, FormDataEntryValue | null> = {};
  if (body.has("name")) payload.name = body.get("name");
  if (body.has("description")) payload.description = body.get("description");
  if (body.has("url_trailer")) payload.url_trailer = body.get("url_trailer");
  if (body.has("thumbnail")) payload.thumbnail = body.get("thumbnail");
  if (body.has("screenshot")) payload.screenshot = body.get("screenshot");

  let validatedData;
  try {
    validatedData = UpdateGameSchema.parse(payload);
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: error };
    return;
  }

  type GameUpdate = Partial<Omit<Game, "id" | "created_at">> & {
    thumbnail_path?: string;
  };
  const updates: GameUpdate = {};
  if (validatedData.name !== undefined) updates["name"] = validatedData.name;
  if (validatedData.description !== undefined) {
    updates["description"] = validatedData.description;
  }
  if (validatedData.url_trailer !== undefined) {
    updates["url_trailer"] = validatedData.url_trailer;
  }

  // Gestion de la nouvelle miniature
  if (validatedData.thumbnail) {
    const extension = validatedData.thumbnail.type.split("/")[1];
    const thumbnail_path = `games/${game.id}/thumb.${extension}`;
    try {
      await cloud.upload(
        thumbnail_path,
        new Uint8Array(await validatedData.thumbnail.arrayBuffer()),
        validatedData.thumbnail.type,
      );
      updates["thumbnail_path"] = thumbnail_path;
    } catch (err) {
      console.error("Error uploading new thumbnail", err);
    }
  }

  // Gestion du nouveau screenshot
  if (validatedData.screenshot) {
    const extension = validatedData.screenshot.type.split("/")[1];
    const screenshot_path = `games/${game.id}/screenshot.${extension}`;
    try {
      await cloud.upload(
        screenshot_path,
        new Uint8Array(await validatedData.screenshot.arrayBuffer()),
        validatedData.screenshot.type,
      );
      updates["path_screenshot"] = screenshot_path;
    } catch (err) {
      console.error("Error uploading new screenshot", err);
    }
  }

  try {
    const updatedGame =
      await gameRepository.updateGame(String(game.id), updates) ?? game;
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Game updated successfully",
      data: { game: await sanitizeGame(updatedGame) },
    };
  } catch (err) {
    console.error("Error updating game", err);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Failed to update game" };
  }
});

router.get("/:gameId", authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  if (!gameId) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Game ID is required" };
    return;
  }

  const game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Game not found" };
    return;
  }

  try {
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: { game: await sanitizeGame(game) },
    };
  } catch (err) {
    console.error("Error while preparing game data", err);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Failed to load game" };
  }
});

router.get("/:gameId/upload-request", authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  let game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = {
      success: false,
      error: "Game not found",
    };
    return;
  }

  const isAuthor = game.author === ctx.state.user.id;
  const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;

  if (!isAuthor && !isAdmin) {
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      error: "You must be the game author or an admin to get an upload request",
    };
    return;
  }

  if (game.status === "success" || game.status === "failed") {
    const compiledPaths = [game.path_js, game.path_wasm, game.path_data].filter(
      Boolean,
    ) as string[];
    for (const p of compiledPaths) {
      try {
        await cloud.delete(p);
      } catch (err) {
        console.warn(`Failed to delete compiled artifact ${p}:`, err);
      }
    }

    try {
      game = await gameRepository.updateGame(String(game.id), {
        path_js: "",
        path_wasm: "",
        path_data: "",
        sources_uploaded: false,
        status: "pending",
      }) ?? game;
    } catch (err) {
      console.error(
        "Error while clearing previous build artifacts and updating DB",
        err,
      );
    }
  }

  if (game.sources_uploaded) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: "Sources have already been uploaded",
    };
    return;
  }

  try {
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        upload_request: await cloud.getPresignedPostForm(
          `games/${game.id}/sources.zip`,
          700 * 1024 * 1024,
          ["application/zip"],
          900,
        ),
      },
    };
  } catch (err) {
    console.error("Error generating upload request", err);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "Failed to generate upload request",
    };
  }
});

router.post("/:gameId/confirm-upload", authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  if (!gameId) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Game ID is required" };
    return;
  }

  const game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Game not found" };
    return;
  }

  const isAuthor = game.author === ctx.state.user.id;
  const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;
  if (!isAuthor && !isAdmin) {
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      error: "You must be the game author or an admin",
    };
    return;
  }

  if (game.sources_uploaded) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: "Sources already marked as uploaded",
    };
    return;
  }

  if (!game.path_sources) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: "No source path configured for this game",
    };
    return;
  }

  try {
    const exists = await cloud.exists(game.path_sources);
    if (!exists) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Source file not found in storage",
      };
      return;
    }
  } catch (err) {
    console.error("Error while checking source file existence", err);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "Failed to verify source file",
    };
    return;
  }

  try {
    const updated = await gameRepository.updateGame(String(game.id), {
      sources_uploaded: true,
      status: "pending",
    }) ?? game;

    await redisClient.lpush("queue:builds", String(game.id));
    ctx.response.status = 202;
    ctx.response.body = {
      success: true,
      message: "Upload confirmed; compilation queued",
      game: await sanitizeGame(updated),
    };
  } catch (err) {
    console.error(
      "Error while marking game as uploaded and queueing compilation",
      err,
    );
    await gameRepository.updateGame(String(game.id), {
      sources_uploaded: false,
      status: game.status,
    }).catch((rollbackErr) => {
      console.error(
        "Error while rolling back game after queue failure",
        rollbackErr,
      );
    });
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "Failed to queue compilation",
    };
  }
});

/**
 * GET /:gameId/logs — WebSocket streaming des logs de build.
 *
 * Utilise exclusivement Redis Streams (XREAD BLOCK) pour diffuser les logs,
 * sans pub/sub. Cela évite la duplication des messages : l'historique et
 * les nouveaux messages sont lus depuis la même source, en séquence,
 * en trackant le dernier ID consommé.
 */
router.get("/:gameId/logs", authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  if (!gameId) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Game ID is required" };
    return;
  }

  const game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Game not found" };
    return;
  }

  const isAuthor = game.author === ctx.state.user.id;
  const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;
  if (!isAuthor && !isAdmin) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: "Forbidden" };
    return;
  }

  if (game.status !== "pending" && game.status !== "running") {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: "Logs are available only while build status is pending or running",
    };
    return;
  }

  if (!ctx.isUpgradable) {
    ctx.response.status = 426;
    ctx.response.body = { success: false, error: "WebSocket upgrade required" };
    return;
  }

  const ws = ctx.upgrade();
  const streamKey = `stream:logs:${gameId}`;
  let closed = false;

  const cleanup = () => {
    closed = true;
  };
  ws.onclose = cleanup;
  ws.onerror = cleanup;

  let streamRedis;
  try {
    streamRedis = await connect({
      hostname: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
  } catch (err) {
    console.error("Error while connecting to Redis for log streaming", err);
    try {
      ws.close(1011, "Redis connection failed");
    } catch (_) {
      return;
    }
    return;
  }

  try {
    let lastXid: XIdInput = 0; // 0 = depuis le début du stream

    while (!closed && ws.readyState === WebSocket.OPEN) {
      try {
        const streams = await streamRedis.xread(
          [{ key: streamKey, xid: lastXid }],
          { block: 500, count: 50 },
        );

        if (!streams || streams.length === 0) continue;

        for (const msg of streams[0].messages) {
          if (closed || ws.readyState !== WebSocket.OPEN) break;

          // Avance le curseur pour la prochaine itération
          lastXid = msg.xid;

          const message = msg.fieldValues["message"] ?? "";
          if (!message) continue;

          ws.send(String(message));

          if (message === "__END__") {
            ws.close(1000, "Build finished");
            closed = true;
            break;
          }
        }
      } catch (err) {
        if (!closed) {
          console.warn("Error while reading Redis stream for logs", err);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error while streaming build logs", err);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, "Log streaming error");
    }
  } finally {
    try {
      streamRedis.close();
    } catch (error) {
      console.error("Erreur lors de la fermeture du flux Redis :", error);
    } finally {
      streamRedis = null;
    }
  }
});

router.delete("/:gameId", authMiddleware, async (ctx) => {
  const gameId = ctx.params.gameId;

  if (!gameId) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Game ID is required" };
    return;
  }

  const game = await gameRepository.getById(gameId);
  if (!game) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Game not found" };
    return;
  }

  // Vérif des droits
  const isAuthor = game.author === ctx.state.user.id;
  const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;
  if (!isAuthor && !isAdmin) {
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      error: "You must be the game author or an admin to delete this game",
    };
    return;
  }

  // nettoyage du cloud
  const pathsToDelete = [
    game.path_sources,
    game.thumbnail_path,
    game.path_screenshot,
    game.path_js,
    game.path_wasm,
    game.path_data,
  ].filter(Boolean) as string[];

  for (const p of pathsToDelete) {
    try {
      await cloud.delete(p);
    } catch (err) {
      console.warn(`Impossible de supprimer le fichier cloud ${p}:`, err);
    }
  }

  // Suppression de la bd
  try {
    const deleted = await gameRepository.deleteGame(String(game.id));
    if (deleted) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Game deleted successfully",
      };
    } else {
      throw new Error("Deletion returned false from database");
    }
  } catch (err) {
    console.error("Error deleting game", err);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Failed to delete game" };
  }
});

export default router;
