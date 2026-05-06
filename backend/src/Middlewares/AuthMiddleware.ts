import {Context} from "https://deno.land/x/oak@v17.1.6/mod.ts";
import {verify} from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import config from "../Config/config.ts";

const authMiddleware = async (ctx: Context, next: () => Promise<unknown>) => {
    const accessToken = await ctx.cookies.get("access_token");

    if (!accessToken) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Missing token" };
        return;
    }

    try {
        ctx.state.tokenData = await verify(accessToken, config.jwtSecret);
        await next();
    } catch (err) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Invalid or expired token" };
    }
};