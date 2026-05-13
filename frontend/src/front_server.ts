import { Application, Router } from "oak";
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

async function serveHtml(ctx: any, fileName: string) {
    try {
        const filePath = join(ROOT, fileName);
        let content = await Deno.readTextFile(filePath);

        // On injecte l'import map juste après le meta charset pour être au top niveau
        if (content.includes('<meta charset="UTF-8">')) {
            content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n${IMPORT_MAP}`);
        } else {
            // Repli sécurisé : juste après l'ouverture du head
            content = content.replace("<head>", `<head>\n${IMPORT_MAP}`);
        }

        ctx.response.type = "text/html";
        ctx.response.body = content;
    } catch (error) {
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

import { send } from "oak";

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

if (Deno.args.length < 1) {
    console.log("Usage: $ deno run --allow-net --allow-read=./ src/front_server.ts PORT [CERT_PATH KEY_PATH]");
    Deno.exit();
}

const listenOptions: Deno.ListenOptions = {
    port: Number(Deno.args[0]),
};

const tlsOptions: { cert?: string; key?: string } = {};
if (Deno.args.length >= 3) {
    tlsOptions.cert = await Deno.readTextFile(Deno.args[1]);
    tlsOptions.key = await Deno.readTextFile(Deno.args[2]);
    console.log("SSL conf ready (use https)");
}

console.log(`Oak front server running on port ${listenOptions.port} for files in ${ROOT}`);

await app.listen({ ...listenOptions, ...tlsOptions });