import { Context, Router } from "oak";
import { z } from "zod";
import { create, getNumericDate } from "djwt";
import userRepository from "../Model/Repository/UserRepository.ts";
import {sanitizeUser, User} from "../Model/DataObjects/User.ts";
import {hashPassword, verifyPassword} from "../Services/passwordService.ts";
import config from "../Config/config.ts";
import redis from "../Services/redis.ts";

const router = new Router({ prefix: "/auth" });

const LoginSchema = z.object({
    username: z.string().trim(),
    password: z.string()
});

type LoginData = z.infer<typeof LoginSchema>;
router.post("/login", async (ctx: Context) => {
    const data = await ctx.request.body.json();
    let parsedData: LoginData | undefined;

    try {
        parsedData = LoginSchema.parse(data);
    }catch (err) {
        ctx.response.status = 400;
        ctx.response.body = {
            success: false,
            error: err
        };
        return;
    }

    const user = await userRepository.getByUsername(parsedData.username);
    if (!user || !(await verifyPassword(parsedData.password, user.password_hash))) {
        ctx.response.status = 401;
        ctx.response.body = {
            success: false,
            error: "Invalid username or password"
        };
        return;
    }

    // Création de l'access token
    const exp = getNumericDate(config.accessTokenLifetime);
    const accessToken = await create({ alg: "HS512", typ: "JWT" }, { userId: user.id, exp: exp }, config.jwtSecret!);
    ctx.cookies.set("access_token", accessToken, {
        httpOnly: true,
        sameSite: config.cookieSamesite,
        secure: config.cookieSecure,
        maxAge: config.accessTokenLifetime,
        path: "/",
    })

    // Création du refresh token
    const refreshToken = crypto.randomUUID();
    const pipe = redis.pipeline();
    pipe.set(`refresh_tokens:${refreshToken}`, user.id!, { ex: config.refreshTokenLifetime });
    pipe.zadd(`user_tokens:${user.id}`, getNumericDate(config.refreshTokenLifetime), refreshToken);
    pipe.expire(`user_tokens:${user.id}`, config.refreshTokenLifetime);
    await pipe.flush();
    ctx.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: config.cookieSamesite,
        secure: config.cookieSecure,
        maxAge: config.refreshTokenLifetime,
        path: "/auth/token/refresh",
    })

    ctx.response.status = 200;
    ctx.response.body = {
        success: true,
        message: "Login successful",
        user: await sanitizeUser(user),
    }
});

router.post("/logout", async (ctx: Context) => {
    const refreshToken = await ctx.cookies.get("refresh_token");

    if (refreshToken) {
        try {
            const userId = await redis.get(`refresh_tokens:${refreshToken}`);

            if (userId) {
                const pipe = redis.pipeline();
                pipe.del(`refresh_tokens:${refreshToken}`);
                pipe.zrem(`user_tokens:${userId}`, refreshToken);
                await pipe.flush();
            }
        } catch (err) {
            console.error("Redis logout error:", err);
        }
    }

    const cookieOptions = {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSamesite,
        maxAge: 0,
    };

    ctx.cookies.set("access_token", "", { ...cookieOptions, path: "/" });
    ctx.cookies.set("refresh_token", "", { ...cookieOptions, path: "/auth/token/refresh" });

    ctx.response.status = 200;
    ctx.response.body = {
        success: true,
        message: "Logout successful"
    };
});

const RegisterSchema = z.object({
    username: z.string().trim()
        .min(3, { message: "Username must be at least 3 characters long" })
        .max(50, { message: "Username cannot exceed 50 characters" }),

    email: z.string().trim()
        .email({ message: "Invalid email format" }),

    password: z.string()
        .min(8, { message: "Password must be at least 8 characters long" }),
});

type RegisterData = z.infer<typeof RegisterSchema>;

router.post("/register", async (ctx: Context) => {
    const data = await ctx.request.body.json();
    let parsedData: RegisterData | undefined;

    try{
        parsedData = RegisterSchema.parse(data);
    }catch(err){
        ctx.response.status = 400;
        ctx.response.body = {
            success: false,
            error: err
        };
        return;
    }

    const existingByEmail = await userRepository.getByEmail(parsedData.email);
    if (existingByEmail) {
        ctx.response.status = 409;
        ctx.response.body = {
            success: false,
            error: "Email already in use"
        };
        return;
    }

    const existingByUsername = await userRepository.getByUsername(parsedData.username);
    if (existingByUsername) {
        ctx.response.status = 409;
        ctx.response.body = {
            success: false,
            error: "Username already in use"
        };
        return;
    }

    const password_hash = await hashPassword(parsedData.password);

    const newUser: User = {
        username: parsedData.username,
        email: parsedData.email,
        password_hash: password_hash
    };

    let createdUser: User;
    try{
        createdUser = await userRepository.create(newUser);
    }catch(_err){
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Failed to create user"
        };
        return;
    }

    ctx.response.status = 201;
    ctx.response.body = {
        success: true,
        message: "User registered successfully",
        user: await sanitizeUser(createdUser),
    };
})

router.post("/token/refresh", async (ctx: Context) => {
    const oldRefreshToken = await ctx.cookies.get("refresh_token");

    if (!oldRefreshToken) {
        ctx.response.status = 401;
        ctx.response.body = { success: false, error: "Refresh token missing" };
        return;
    }

    const userId = await redis.get(`refresh_tokens:${oldRefreshToken}`);

    if (!userId) {
        ctx.response.status = 401;
        ctx.response.body = { success: false, error: "Invalid or expired refresh token" };
        return;
    }

    const userIdStr = String(userId);
    const lockKey = `lock:refresh:${userIdStr}`;

    const lockResult = await redis.sendCommand("SET", lockKey, "locked", "EX", "5", "NX");

    if (lockResult === null || lockResult === undefined) {
        ctx.response.status = 429;
        ctx.response.body = { success: false, error: "Refresh already in progress. Please retry." };
        return;
    }

    try {
        const user = await userRepository.getById(Number(userIdStr));
        if (!user) {
            ctx.response.status = 401;
            ctx.response.body = { success: false, error: "User not found" };
            return;
        }

        const newRefreshToken = crypto.randomUUID();
        const newAccessExp = getNumericDate(config.accessTokenLifetime);
        const newRefreshExp = getNumericDate(config.refreshTokenLifetime);

        const pipe = redis.pipeline();
        pipe.del(`refresh_tokens:${oldRefreshToken}`);
        pipe.zrem(`user_tokens:${userIdStr}`, oldRefreshToken);
        pipe.set(`refresh_tokens:${newRefreshToken}`, userIdStr, { ex: config.refreshTokenLifetime });
        pipe.zadd(`user_tokens:${userIdStr}`, newRefreshExp, newRefreshToken);
        pipe.expire(`user_tokens:${userIdStr}`, config.refreshTokenLifetime);
        await pipe.flush();

        const accessToken = await create(
            { alg: "HS512", typ: "JWT" },
            { userId: user.id, exp: newAccessExp },
            config.jwtSecret!
        );

        const cookieOptions = {
            httpOnly: true,
            secure: config.cookieSecure,
            sameSite: config.cookieSamesite,
        };

        ctx.cookies.set("access_token", accessToken, {
            ...cookieOptions,
            maxAge: config.accessTokenLifetime,
            path: "/",
        });

        ctx.cookies.set("refresh_token", newRefreshToken, {
            ...cookieOptions,
            maxAge: config.refreshTokenLifetime,
            path: "/auth/token/refresh",
        });

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Token refreshed successfully" };

    } catch (err) {
        console.error("Refresh error:", err);
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: "Internal server error" };
    } finally {
        await redis.del(lockKey);
    }
});

export default router;