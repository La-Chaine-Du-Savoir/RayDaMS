import { Context, Router } from "oak";
import { z } from "zod";
import { create, getNumericDate } from "djwt";
import userRepository from "../Model/Repository/UserRepository.ts";
import { sanitizeUser, User } from "../Model/DataObjects/User.ts";
import { hashPassword, verifyPassword } from "../Services/passwordService.ts";
import config from "../Config/config.ts";
import redis from "../Services/redis.ts";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";

const router = new Router({ prefix: "/auth" });

const LoginSchema = z.object({
  username: z.string().trim(),
  password: z.string(),
});

type LoginData = z.infer<typeof LoginSchema>;
router.post("/login", async (ctx: Context) => {
  const data = await ctx.request.body.json();
  let parsedData: LoginData | undefined;

  try {
    parsedData = LoginSchema.parse(data);
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: err,
    };
    return;
  }

  const user = await userRepository.getByUsername(parsedData.username);
  if (
    !user || !(await verifyPassword(parsedData.password, user.password_hash))
  ) {
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      error: "Invalid username or password",
    };
    return;
  }

  // Création de l'access token
  const exp = getNumericDate(config.accessTokenLifetime);
  const accessToken = await create({ alg: "HS512", typ: "JWT" }, {
    userId: user.id,
    exp: exp,
  }, config.jwtSecret!);
  ctx.cookies.set("access_token", accessToken, {
    httpOnly: true,
    sameSite: config.cookieSamesite,
    secure: config.cookieSecure,
    maxAge: config.accessTokenLifetime,
    path: "/",
    ignoreInsecure: true,
  });

  // Création du refresh token
  const refreshToken = crypto.randomUUID();
  const pipe = redis.pipeline();
  pipe.set(`refresh_tokens:${refreshToken}`, user.id!, {
    ex: config.refreshTokenLifetime,
  });
  pipe.zadd(
    `user_tokens:${user.id}`,
    getNumericDate(config.refreshTokenLifetime),
    refreshToken,
  );
  pipe.expire(`user_tokens:${user.id}`, config.refreshTokenLifetime);
  await pipe.flush();
  ctx.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: config.cookieSamesite,
    secure: config.cookieSecure,
    maxAge: config.refreshTokenLifetime,
    path: "/auth/token/refresh",
    ignoreInsecure: true,
  });

  ctx.response.status = 200;
  ctx.response.body = {
    success: true,
    message: "Login successful",
    user: await sanitizeUser(user),
  };
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

  ctx.cookies.set("access_token", "", {
    ...cookieOptions,
    path: "/",
    ignoreInsecure: true,
  });
  ctx.cookies.set("refresh_token", "", {
    ...cookieOptions,
    path: "/auth/token/refresh",
    ignoreInsecure: true,
  });

  ctx.response.status = 200;
  ctx.response.body = {
    success: true,
    message: "Logout successful",
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

  try {
    parsedData = RegisterSchema.parse(data);
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      error: err,
    };
    return;
  }

  const existingByEmail = await userRepository.getByEmail(parsedData.email);
  if (existingByEmail) {
    ctx.response.status = 409;
    ctx.response.body = {
      success: false,
      error: "Email already in use",
    };
    return;
  }

  const existingByUsername = await userRepository.getByUsername(
    parsedData.username,
  );
  if (existingByUsername) {
    ctx.response.status = 409;
    ctx.response.body = {
      success: false,
      error: "Username already in use",
    };
    return;
  }

  const password_hash = await hashPassword(parsedData.password);

  const newUser: User = {
    username: parsedData.username,
    email: parsedData.email,
    password_hash: password_hash,
  };

  let createdUser: User;
  try {
    createdUser = await userRepository.create(newUser);
  } catch (_err) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Failed to create user",
    };
    return;
  }

  ctx.response.status = 201;
  ctx.response.body = {
    success: true,
    message: "User registered successfully",
    user: await sanitizeUser(createdUser),
  };
});

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
    ctx.response.body = {
      success: false,
      error: "Invalid or expired refresh token",
    };
    return;
  }

  const userIdStr = String(userId);
  const lockKey = `lock:refresh:${userIdStr}`;

  const lockResult = await redis.sendCommand(
    "SET",
    lockKey,
    "locked",
    "EX",
    "5",
    "NX",
  );

  if (lockResult === null || lockResult === undefined) {
    ctx.response.status = 429;
    ctx.response.body = {
      success: false,
      error: "Refresh already in progress. Please retry.",
    };
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
    pipe.set(`refresh_tokens:${newRefreshToken}`, userIdStr, {
      ex: config.refreshTokenLifetime,
    });
    pipe.zadd(`user_tokens:${userIdStr}`, newRefreshExp, newRefreshToken);
    pipe.expire(`user_tokens:${userIdStr}`, config.refreshTokenLifetime);
    await pipe.flush();

    const accessToken = await create(
      { alg: "HS512", typ: "JWT" },
      { userId: user.id, exp: newAccessExp },
      config.jwtSecret!,
    );

    const cookieOptions = {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSamesite,
      ignoreInsecure: true,
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
    ctx.response.body = {
      success: true,
      message: "Token refreshed successfully",
      user: await sanitizeUser(user),
    };
  } catch (err) {
    console.error("Refresh error:", err);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  } finally {
    await redis.del(lockKey);
  }
});

router.patch("/password", authMiddleware, async (ctx: Context) => {
  const currentUser = ctx.state.user;

  try {
    const body = await ctx.request.body.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Tous les champs sont requis.",
      };
      return;
    }

    if (newPassword.length < 8) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Le nouveau mot de passe doit faire au moins 8 caractères.",
      };
      return;
    }

    const userInDb = await userRepository.getById(currentUser.id);
    if (!userInDb) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, error: "Utilisateur introuvable." };
      return;
    }

    const isValid = await verifyPassword(oldPassword, userInDb.password_hash);
    if (!isValid) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        error: "Mot de passe actuel incorrect.",
      };
      return;
    }

    const newHash = await hashPassword(newPassword);
    const updated = await userRepository.updatePassword(
      currentUser.id,
      newHash,
    );

    if (!updated) {
      throw new Error("Échec de la mise à jour en BDD.");
    }

    // invalidation de tous les anciens tokens (redis)
    const userIdStr = String(currentUser.id);
    const tokens = await redis.zrange(`user_tokens:${userIdStr}`, 0, -1); // Récupère toute la liste

    if (tokens && tokens.length > 0) {
      const delPipe = redis.pipeline();
      for (const token of tokens) {
        delPipe.del(`refresh_tokens:${token}`); // Supprime chaque relation refresh_token -> userId
      }
      delPipe.del(`user_tokens:${userIdStr}`); // Supprime la liste de l'utilisateur
      await delPipe.flush();
    }

    // Création de nouveaux tokens pour la session en cours
    const newAccessExp = getNumericDate(config.accessTokenLifetime);
    const newRefreshExp = getNumericDate(config.refreshTokenLifetime);
    const newRefreshToken = crypto.randomUUID();

    const createPipe = redis.pipeline();
    createPipe.set(`refresh_tokens:${newRefreshToken}`, userIdStr, {
      ex: config.refreshTokenLifetime,
    });
    createPipe.zadd(`user_tokens:${userIdStr}`, newRefreshExp, newRefreshToken);
    createPipe.expire(`user_tokens:${userIdStr}`, config.refreshTokenLifetime);
    await createPipe.flush();

    const accessToken = await create(
      { alg: "HS512", typ: "JWT" },
      { userId: currentUser.id, exp: newAccessExp },
      config.jwtSecret!,
    );

    // écrasement des cookie sur le navigateur
    const cookieOptions = {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSamesite,
      ignoreInsecure: true,
    };

    ctx.cookies.set("access_token", accessToken, {
      ...cookieOptions,
      maxAge: config.accessTokenLifetime,
      path: "/",
    });

    ctx.cookies.set("refresh_token", newRefreshToken, {
      ...cookieOptions,
      maxAge: config.refreshTokenLifetime,
      path: "/auth/token/refresh", // le path doit être identique pour écraser le cookie
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Mot de passe mis à jour et sessions réinitialisées.",
    };
  } catch (err) {
    console.error("Erreur update password:", err);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Erreur interne du serveur." };
  }
});

export default router;
