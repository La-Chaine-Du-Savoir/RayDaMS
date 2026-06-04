import { Application } from "oak";
import { equal } from "node:assert/strict";
import { startServer } from "./utils/server.ts";

import { createAuthRouter } from "app/Routes/AuthRoutes.ts";
import userRepoMock from "./mocks/user_repo.ts";
import redisMock from "./mocks/redis.ts";

const router = createAuthRouter(userRepoMock, redisMock);
const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

async function requestJson(
  url: string,
  method: string,
  body?: Record<string, unknown>,
  cookie?: string,
) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  if (cookie) {
    opts.headers = {
      ...(opts.headers as Record<string, string>),
      Cookie: cookie,
    };
  }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

Deno.test("POST /auth/login succeeds with correct credentials", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/login`, "POST", {
      username: "testuser",
      password: "password",
    });
    equal(r.status, 200);
    equal(r.body.success, true);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/login fails with wrong password", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/login`, "POST", {
      username: "testuser",
      password: "wrong",
    });
    equal(r.status, 401);
    equal(r.body.success, false);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/register succeeds when new user", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/register`, "POST", {
      username: "newuser",
      email: "new@example.com",
      password: "password123",
    });
    equal(r.status, 201);
    equal(r.body.success, true);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/register fails when email exists", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/register`, "POST", {
      username: "another",
      email: "existing@example.com",
      password: "password123",
    });
    equal(r.status, 409);
    equal(r.body.success, false);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/register fails when username exists", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/register`, "POST", {
      username: "existing",
      email: "unique@example.com",
      password: "password123",
    });
    equal(r.status, 409);
    equal(r.body.success, false);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/token/refresh fails without cookie", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(`${srv.url}/auth/token/refresh`, "POST");
    equal(r.status, 401);
    equal(r.body.success, false);
  } finally {
    await srv.stop();
  }
});

Deno.test("POST /auth/token/refresh succeeds with valid refresh token cookie", async () => {
  const srv = await startServer(app);
  try {
    const r = await requestJson(
      `${srv.url}/auth/token/refresh`,
      "POST",
      undefined,
      "refresh_token=abc",
    );
    equal(r.status, 200);
    equal(r.body.success, true);
  } finally {
    await srv.stop();
  }
});
