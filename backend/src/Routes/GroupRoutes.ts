import { Context, Router } from "oak";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import {restrictToAdmin} from "../Middlewares/restrictionMiddleware.ts";
import {Group, GroupWithUsers} from "../Model/DataObjects/Group.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import { Game, sanitizeGame } from "../Model/DataObjects/Game.ts";
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateGroupCode = customAlphabet(alphabet, 10);

const router = new Router({ prefix: "/groups" });

// --- SCHEMAS ---
const CreateGroupSchema = z.object({
    name: z.string().trim()
        .min(3, { message: "Group name must be at least 3 characters long" })
        .max(50, { message: "Group name cannot exceed 50 characters" }),
});

const UpdateGroupSchema = z.object({
    name: z.string().trim()
        .min(3, { message: "Group name must be at least 3 characters long" })
        .max(50, { message: "Group name cannot exceed 50 characters" }),
});


type CreateGroupData = z.infer<typeof CreateGroupSchema>;
type UpdateGroupData = z.infer<typeof UpdateGroupSchema>;


router.post("/", ...restrictToAdmin, async (ctx: Context) => {

    const data = await ctx.request.body.json();
    let parsedData: CreateGroupData | undefined;

    try{
        parsedData = CreateGroupSchema.parse(data);
    }catch(err){
        ctx.response.status = 400;
        ctx.response.body = {
            success: false,
            error: err
        };
        return;
    }

    const newGroup: Group = {
        name: parsedData.name,
        code: generateGroupCode(),
    };

    let createdGroup: Group;
    try{
        createdGroup = await groupRepository.create(newGroup);
    }catch(_err){
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Failed to create group"
        };
        return;
    }

    ctx.response.status = 201;
    ctx.response.body = {
        success: true,
        message: "Group created successfully",
        group: createdGroup,
    };
});

router.get("/", authMiddleware, async (ctx: Context) => {
    try {
        const groups:GroupWithUsers[] = await groupRepository.getAllGroups();
        ctx.response.status = 200;
        ctx.response.body = { success: true, groups };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to fetch groups" };
    }
});

router.get("/with-games", authMiddleware, async (ctx: Context) => {
    try {
        const rawGroups = await groupRepository.getGroupsWithGames();
        
        const userId = ctx.state.user.id;
        const isAdmin = ctx.state.user.roles?.includes("admin") ?? false;

        // On nettoie les données et on injecte le booléen canEdit pour le front
        let groupsWithGames = rawGroups.map((group: any) => {
            const isMember = group.member_ids.includes(userId);
            
            return {
                id: group.id,
                name: group.name,
                code: group.code,
                canEdit: isMember || isAdmin, // Vrai si membre du groupe ou admin
                games: group.games
            };
        });

        groupsWithGames = await Promise.all(
            groupsWithGames.map(async (group) => {
                if (group.games && group.games.length > 0) {
                    // On attend la résolution de toutes les promesses pour les jeux
                    group.games = await Promise.all(
                        group.games.map(async (game: Game) => {
                            return await sanitizeGame(game);
                        })
                    );
                }
                return group;
            })
        );

        ctx.response.status = 200;
        ctx.response.body = { success: true, groups: groupsWithGames };
    } catch (err) {
        console.error("Error fetching groups with games:", err);
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to fetch dashboard data" };
    }
});

router.get("/:id", authMiddleware, async (ctx) => {
    const groupId = parseInt(ctx.params.id);

    if (isNaN(groupId)) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, message: "Invalid group ID" };
        return;
    }

    try {

        const group:GroupWithUsers|undefined = await groupRepository.getById(groupId);

        if (!group) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "Group not found" };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { success: true, group };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to fetch group details" };
    }
});

router.post("/join", authMiddleware, async (ctx: Context) => {
    const body = await ctx.request.body.json();
    const code = body.code;
    const user = ctx.state.user;

    if (!code) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, message: "Join code is required" };
        return;
    }

    try {
        const group = await groupRepository.getByCode(code);

        if (!group) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "Invalid group code" };
            return;
        }

        await groupRepository.addUserToGroup(group.id!, user.id);

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Successfully joined the group", group };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to join group" };
    }
});

router.patch("/:id", authMiddleware, ...restrictToAdmin, async (ctx) => {
    const groupId = parseInt(ctx.params.id);
    if (isNaN(groupId)) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, message: "Invalid group ID" };
        return;
    }

    const data = await ctx.request.body.json();
    let parsedData: UpdateGroupData;

    try {
        parsedData = UpdateGroupSchema.parse(data);
    } catch (err) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, error: err };
        return;
    }

    try {
        const updatedGroup = await groupRepository.updateGroupName(groupId, parsedData.name);

        if (!updatedGroup) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "Group not found" };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Group updated", group: updatedGroup };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to update group" };
    }
});

router.delete("/:id/users/:userId", ...restrictToAdmin, async (ctx) => {
    const groupId = parseInt(ctx.params.id);
    const userId = parseInt(ctx.params.userId);

    if (isNaN(groupId) || isNaN(userId)) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, message: "Invalid group or user ID" };
        return;
    }

    try {
        const success = await groupRepository.removeUserFromGroup(groupId, userId);

        if (!success) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "User is not in this group or group doesn't exist" };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "User removed from group" };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to remove user" };
    }
});

router.delete("/:id", ...restrictToAdmin, async (ctx) => {
    const groupId = parseInt(ctx.params.id);

    if (isNaN(groupId)) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, message: "Invalid group ID" };
        return;
    }

    try {
        const success = await groupRepository.deleteGroup(groupId);

        if (!success) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "Group not found" };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Group deleted successfully" };
    } catch (_err) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Failed to delete group" };
    }
});


export default router;