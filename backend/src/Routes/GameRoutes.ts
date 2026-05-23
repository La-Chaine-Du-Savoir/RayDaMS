import { Context, Router } from "oak";
import { z } from "zod";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import cloud from "../Services/cloud.ts";
import {Game, sanitizeGame} from "../Model/DataObjects/Game.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import gameRepository from "../Model/Repository/GameRepository.ts";

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
router.post("/", authMiddleware, async (ctx: Context) => {
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

	const game = await gameRepository.getById(gameId);
	if (!game) {
		ctx.response.status = 404;
		ctx.response.body = {
			success: false,
			error: "Game not found"
		};
		return;
	}

	if (game.sources_uploaded) {
		ctx.response.status = 400;
		ctx.response.body = {
			success: false,
			error: "Sources have already been uploaded"
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

export default router;

