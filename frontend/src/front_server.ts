import { Application, Router, send } from "oak";
import { join } from "path";

const app = new Application();
const router = new Router();
const ROOT = join(Deno.cwd(), "src");

const IMPORT_MAP = `
    <script type="importmap">
        {
          "imports": {
            "lit": "https://esm.sh/lit@3"
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
            content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n${IMPORT_MAP}`);
        } else {
            content = content.replace("<head>", `<head>\n${IMPORT_MAP}`);
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

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (ctx) => {
    try {
        await send(ctx, ctx.request.url.pathname, {
            root: ROOT,
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