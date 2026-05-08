import { Context, Router } from "oak";
import { z } from "zod";
import userRepository from "../Model/Repository/UserRepository.ts";
import {sanitizeUser, User} from "../Model/DataObjects/User.ts";

const router = new Router({ prefix: "/auth" });

router.post("/login", (_ctx: Context) => {
    _ctx.response.status = 501;
    _ctx.response.body = { error: "Not implemented" };
});

router.post("/logout", (ctx: Context) => {
    ctx.cookies.set("access_token", "", {
        maxAge: 0,
        httpOnly: true,
        path: "/",
    });

    ctx.cookies.set("refresh_token", "", {
        maxAge: 0,
        httpOnly: true,
        path: "/auth/token/refresh",
    });

    ctx.response.status = 200;
    ctx.response.body = { message: "Logout successful" };
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
        message: "User registered successfully",
        user: sanitizeUser(createdUser),
    };
})

router.post("/token/refresh", (_ctx: Context) => {
    _ctx.response.status = 501;
    _ctx.response.body = { error: "Not implemented" };
});

export default router;

//TODO inclure ceci dans un PasswordService
async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: 100000,
        },
        baseKey,
        256,
    );

    return `pbkdf2$100000$${toBase64(salt)}$${toBase64(new Uint8Array(derivedBits))}`;
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

