import { Context } from "oak";
import { verify } from "djwt";
import config from "../Config/config.ts";
import UserRepository from "../Model/Repository/UserRepository.ts";

export default async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
    const accessToken = await ctx.cookies.get("access_token");

    if (!accessToken) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Missing token" };
        return;
    }

    if (!config.jwtSecret) {
        ctx.response.status = 500;
        ctx.response.body = { error: "Server misconfiguration: JWT key not initialized" };
        return;
    }

    try {
        const tokenData = await verify<{ userId: number }>(accessToken, config.jwtSecret);
        ctx.state.user = await UserRepository.getById(tokenData.userId);
        if(!ctx.state.user) {
            ctx.response.status = 401;
            ctx.response.body = { error: "Unauthorized: User not found" };
            return;
        }
        await next();
    } catch (_err) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Invalid or expired token" };
    }
}
