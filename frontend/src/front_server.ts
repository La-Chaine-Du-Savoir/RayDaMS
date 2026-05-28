import { Application, Router, send } from "oak";
import { join } from "path";

const app = new Application();
const router = new Router();
const ROOT = import.meta.dirname || join(Deno.cwd(), "src");
const PUBLIC_DIR = join(ROOT, "public");

const appConfig = {
    API_URL: Deno.env.get("API_URL") || "http://localhost:3000",
};

const rawConfig = JSON.stringify(appConfig);

const INJECTIONS = `
    <script>window.APP_CONFIG = ${rawConfig};</script>
    <script type="importmap">
        {
          "imports": {
            "lit": "https://esm.sh/lit@3",
            "axios": "https://esm.sh/axios@1.16"
          }
        }
    </script>`;

if (Deno.args.length < 1) {
    console.log("Usage: $ deno run --allow-net --allow-read=./ src/front_server.ts PORT [--cache] [CERT_PATH KEY_PATH]");
    Deno.exit(1);
}

const args = Deno.args;
const USE_CACHE = args.includes("--cache");

const positionalArgs = args.filter(arg => !arg.startsWith("--"));
const PORT = Number(positionalArgs[0]);

const htmlCache = new Map<string, string>();

async function serveHtml(ctx: any, fileName: string) {
    try {
        if (USE_CACHE && htmlCache.has(fileName)) {
            ctx.response.type = "text/html";
            ctx.response.body = htmlCache.get(fileName);
            return;
        }

        const filePath = join(ROOT, fileName);
        let content = await Deno.readTextFile(filePath);

        if (content.includes('<meta charset="UTF-8">')) {
            content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n${INJECTIONS}`);
        } else {
            content = content.replace("<head>", `<head>\n${INJECTIONS}`);
        }

        if (USE_CACHE) {
            htmlCache.set(fileName, content);
        }

        ctx.response.type = "text/html";
        ctx.response.body = content;
    } catch (_error) {
        ctx.response.status = 404;
        ctx.response.body = "404 - Page non trouvée";
    }
}

router.get("/", async (ctx) => {
    await serveHtml(ctx, "pages/index.html");
});

router.get("/login", async (ctx) => {
    await serveHtml(ctx, "pages/login.html");
});

router.get("/register", async (ctx) => {
    await serveHtml(ctx, "pages/register.html");
});

router.get("/about", async (ctx) => {
    await serveHtml(ctx, "pages/about.html");
});

router.get("/profile", async (ctx) => {
    await serveHtml(ctx, "pages/profile.html");
});

router.get("/upload", async (ctx) => {
    await serveHtml(ctx, "pages/upload-game.html");
});

router.get("/games", async (ctx) => {
    await serveHtml(ctx, "pages/games.html");
});

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (ctx) => {
    try {
        await send(ctx, ctx.request.url.pathname, {
            root: PUBLIC_DIR,
        });
    } catch {
        ctx.response.status = 404;
        ctx.response.body = "404 File not found";
    }
});

const listenOptions: Deno.ListenOptions = {
    port: PORT,
};

const tlsOptions: { cert?: string; key?: string } = {};

if (positionalArgs.length >= 3) {
    tlsOptions.cert = await Deno.readTextFile(positionalArgs[1]);
    tlsOptions.key = await Deno.readTextFile(positionalArgs[2]);
    console.log("SSL conf ready (use https)");
}

console.log(`Oak front server running on port ${listenOptions.port} for files in ${ROOT}`);
console.log(`Cache mode: ${USE_CACHE ? "ENABLED ✅" : "DISABLED ❌"}`);

await app.listen({ ...listenOptions, ...tlsOptions });