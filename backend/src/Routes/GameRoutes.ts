import {Context, Router} from "oak";
import {connect} from "redis";
import {z} from "zod";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import cloud from "../Services/cloud.ts";
import redisClient from "../Services/redis.ts";
import config from "../Config/config.ts";
import {Game, sanitizeGame} from "../Model/DataObjects/Game.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import gameRepository from "../Model/Repository/GameRepository.ts";
import formDataMiddleware from "../Middlewares/formDataMiddleware.ts";

const router = new Router({ prefix: "/games" });

const ACCEPTED_IMAGE_TYPES = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
			message: "Format invalide. Seuls les formats .jpg, .jpeg, .png et .webp sont acceptés.",
		})
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

	const payload = {
		name: name,
		description: description,
		group_id: rawGroupId ? Number(rawGroupId) : undefined,
		url_trailer: url_trailer,
		thumbnail: thumbnailFile,
	};

	let validatedData: CreateGameData;
	try {
		validatedData = CreateGameSchema.parse(payload);
	}catch (error) {
		ctx.response.status = 400;
		ctx.response.body = {
			success: false,
			error: error
		};
		return;
	}

	const group = await groupRepository.getById(validatedData.group_id);
	if (!group) {
		ctx.response.status = 400;
		ctx.response.body = {
			success: false,
			error: "Invalid group ID"
		};
		return;
	}else if(group.users.find(u => u.id === ctx.state.user.id) === undefined && ctx.state.user.roles.includes("admin") === false){
		ctx.response.status = 403;
		ctx.response.body = {
			success: false,
			error: "You must be a member of the group to add a game to it"
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
			author: ctx.state.user.id
		});
	}catch(_err){
		ctx.response.status = 500;
		ctx.response.body = {
			success: false,
			message: "Failed to create game"
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
				validatedData.thumbnail.type
			);
			updates["thumbnail_path"] = thumbnail_path;
		} catch (err) {
			console.error('Error while uploading thumbnail', err);
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
			["application/zip"]
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
	}
});

router.get("/:gameId/upload-request", authMiddleware, async (ctx) => {
	const gameId = ctx.params.gameId;

	let game = await gameRepository.getById(gameId);
	if (!game) {
		ctx.response.status = 404;
		ctx.response.body = {
			success: false,
			error: "Game not found"
		};
		return;
	}

	const isAuthor = game.author === ctx.state.user.id;
	const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;

	if (!isAuthor && !isAdmin) {
		ctx.response.status = 403;
		ctx.response.body = {
			success: false,
			error: "You must be the game author or an admin to get an upload request"
		};
		return;
	}

	if (game.status === "success" || game.status === "failed") {
		const compiledPaths = [game.path_js, game.path_wasm, game.path_data].filter(Boolean) as string[];
		for (const p of compiledPaths) {
			try {
				await cloud.delete(p);
			} catch (err) {
				console.warn(`Failed to delete compiled artifact ${p}:`, err);
			}
		}

		try {
			game = await gameRepository.updateGame(String(game.id), {
				path_js: '',
				path_wasm: '',
				path_data: '',
				sources_uploaded: false,
				status: 'pending'
			}) ?? game;
		} catch (err) {
			console.error("Error while clearing previous build artifacts and updating DB", err);
		}
	}

	if (game.sources_uploaded) {
		ctx.response.status = 400;
		ctx.response.body = {
			success: false,
			error: "Sources have already been uploaded"
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
					900
				)
			}
		};
	} catch (err) {
		console.error("Error generating upload request", err);
		ctx.response.status = 500;
		ctx.response.body = {
			success: false,
			error: "Failed to generate upload request"
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
		ctx.response.body = { success: false, error: "You must be the game author or an admin" };
		return;
	}

	if (game.sources_uploaded) {
		ctx.response.status = 400;
		ctx.response.body = { success: false, error: "Sources already marked as uploaded" };
		return;
	}

	if (!game.path_sources) {
		ctx.response.status = 400;
		ctx.response.body = { success: false, error: "No source path configured for this game" };
		return;
	}

	try {
		const exists = await cloud.exists(game.path_sources);
		if (!exists) {
			ctx.response.status = 400;
			ctx.response.body = { success: false, error: "Source file not found in storage" };
			return;
		}
	} catch (err) {
		console.error("Error while checking source file existence", err);
		ctx.response.status = 500;
		ctx.response.body = { success: false, error: "Failed to verify source file" };
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
		console.error("Error while marking game as uploaded and queueing compilation", err);
		await gameRepository.updateGame(String(game.id), {
			sources_uploaded: false,
			status: game.status,
		}).catch((rollbackErr) => {
			console.error("Error while rolling back game after queue failure", rollbackErr);
		});
		ctx.response.status = 500;
		ctx.response.body = { success: false, error: "Failed to queue compilation" };
	}
});

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
	const channel = `logs:${gameId}`;
	const streamKey = `stream:${channel}`;
	let closed = false;

	let subRedis;
	let subscription;
	try {
		subRedis = await connect({
			hostname: config.redis.host,
			port: config.redis.port,
			password: config.redis.password,
		});

		// Charger l'historique complet du stream
		try {
			const history = await subRedis.xrange(streamKey, "-", "+");
			for (const entry of history) {
				if (closed || ws.readyState !== WebSocket.OPEN) {
					break;
				}
				const entryObj = entry as unknown as Record<string, unknown>;
				let message: string | undefined;
				if (typeof entryObj === "object" && entryObj) {
					if ("message" in entryObj && typeof entryObj.message === "string") {
						message = entryObj.message;
					} else if (entryObj.message && typeof entryObj.message === "object") {
						const msgMap = entryObj.message as Record<string, unknown>;
						message = String(msgMap["message"] ?? msgMap["msg"] ?? "");
					}
				}
				if (message) {
					ws.send(String(message));
					if (message === "__END__") {
						// Si le stream contient déjà __END__, fermer
						ws.close(1000, "Build finished");
						closed = true;
						subRedis.close();
						return;
					}
				}
			}
		} catch (histErr) {
			console.warn("Error while loading build history", histErr);
		}

		// S'abonner pour les nouveaux messages
		subscription = await subRedis.subscribe(channel);
	} catch (err) {
		console.error("Error while creating logs subscription", err);
		try {
			ws.close(1011, "Subscription failed");
		} catch (_closeErr) {
			// no-op
		}
		if (subscription) {
			subscription.close();
		}
		if (subRedis) {
			subRedis.close();
		}
		return;
	}

	const cleanup = () => {
		if (closed) return;
		closed = true;
		try {
			subscription?.close();
		} catch (_err) {
			// no-op
		}
		try {
			subRedis?.close();
		} catch (_err) {
			// no-op
		}
	};

	ws.onclose = cleanup;
	ws.onerror = cleanup;

	try {
		for await (const msg of subscription.receive()) {
			if (closed || ws.readyState !== WebSocket.OPEN) {
				break;
			}
			const line = String(msg.message ?? "");
			ws.send(line);
			if (line === "__END__") {
				ws.close(1000, "Build finished");
				break;
			}
		}
	} catch (err) {
		console.error("Error while streaming build logs", err);
		if (ws.readyState === WebSocket.OPEN) {
			ws.close(1011, "Log streaming error");
		}
	} finally {
		cleanup();
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

	const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;

	try {
		const group = await groupRepository.getById(game.group_id);
		const isMember = !!group?.users?.find((u) => u.id === ctx.state.user.id);

		if (!isMember && !isAdmin) {
			ctx.response.status = 403;
			ctx.response.body = { success: false, error: "You must be a member of the group or an admin to access this game" };
			return;
		}

		ctx.response.status = 200;
		ctx.response.body = { success: true, data: { game: await sanitizeGame(game) } };
	} catch (err) {
		console.error("Error while verifying group membership for game access", err);
		ctx.response.status = 500;
		ctx.response.body = { success: false, error: "Failed to verify access rights" };
	}
});

export default router;

