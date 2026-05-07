import { Context } from "oak";
import { verify } from "djwt";
import config from "../Config/config.ts";

const jwtKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(config.jwtSecret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["verify"],
);

export default async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
    const accessToken = await ctx.cookies.get("access_token");

    if (!accessToken) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Missing token" };
        return;
    }

    try {
        ctx.state.tokenData = await verify(accessToken, jwtKey);
        await next();
    } catch (err) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Invalid or expired token" };
    }
}
