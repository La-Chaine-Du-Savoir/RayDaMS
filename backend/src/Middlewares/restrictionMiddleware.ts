import { Context } from "oak";
import authMiddleware from "./AuthMiddleware.ts";
import type { Middleware } from "oak";

const checkRole = (allowedRoles: string[]): Middleware => {
  return async (ctx: Context, next: () => Promise<unknown>) => {
    const user = ctx.state.user;

    const hasPermission = user && Array.isArray(user.roles) &&
      user.roles.some((role: string) => allowedRoles.includes(role));

    if (!hasPermission) {
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
    checkRole(allowedRoles),
  ];
}

export const restrictToAdmin = restrictTo(["admin"]);
