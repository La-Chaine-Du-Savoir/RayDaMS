import { Context } from "oak";
import authMiddleware from "./AuthMiddleware.ts";
import { Middleware } from "https://deno.land/x/oak@v17.1.6/middleware.ts";

const checkRole = (allowedRoles: string[]): Middleware => {
    return async (ctx: Context, next: () => Promise<unknown>) => {
        const user = ctx.state.user;

        if (!user || !allowedRoles.includes(user.role)) {
            ctx.response.status = 403;
            ctx.response.body = { error: "Forbidden: Insufficient permissions" };
            return;
        }

        await next();
    };
};

export function restrictTo(allowedRoles: string[]): [Middleware, Middleware] {
    return [
        authMiddleware,
        checkRole(allowedRoles)
    ];
}

export const restrictToAdmin = restrictTo(["admin"]);