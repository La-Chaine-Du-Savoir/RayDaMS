import { Application } from "oak";
import { equal } from "node:assert/strict";
import { startServer } from "./utils/server.ts";

import { create } from "djwt";
import config from "app/Config/config.ts";
import { createAuthMiddleware } from "app/Middlewares/AuthMiddleware.ts";
import userRepoMock from "./mocks/user_repo.ts";

const middleware = createAuthMiddleware(userRepoMock);

const app = new Application();
app.use(middleware);
app.use((ctx) => {
  ctx.response.status = 200;
  ctx.response.body = { ok: true };
});

async function request(path: string, cookie?: string) {
  const srv = await startServer(app);
  try {
    const res = await fetch(`${srv.url}${path}`, {
      headers: cookie ? { Cookie: cookie } : undefined,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    await srv.stop();
  }
}

Deno.test("auth middleware allows request with valid token", async () => {
  const token = await create({ alg: "HS512", typ: "JWT" }, {
    userId: 2,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, config.jwtSecret!);
  const r = await request("/", "access_token=" + token);
  equal(r.status, 200);
  equal(r.body.ok, true);
});

Deno.test("auth middleware rejects request without token", async () => {
  const r = await request("/");
  equal(r.status, 401);
  const err = String(r.body?.error ?? "");
  equal(err.includes("Missing token"), true);
});
