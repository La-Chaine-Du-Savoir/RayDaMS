import { Context, Router } from "oak";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import {restrictToAdmin} from "../Middlewares/restrictionMiddleware.ts";
import {Group} from "../Model/DataObjects/Group.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateGroupCode = customAlphabet(alphabet, 10);

const router = new Router({ prefix: "/group" });

const CreateGroupSchema = z.object({
    name: z.string().trim()
        .min(3, { message: "Group name must be at least 3 characters long" })
        .max(50, { message: "Group name cannot exceed 50 characters" }),
});

type CreateGroupData = z.infer<typeof CreateGroupSchema>;

router.post("/group", ...restrictToAdmin, async (ctx: Context) => {

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
})


export default router;