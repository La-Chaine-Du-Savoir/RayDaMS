import { Application, Router, send } from "oak";
import { join } from "path";

const app = new Application();
const router = new Router();
const ROOT = join(Deno.cwd(), "src");

router.get("/", async (ctx) => {
    await send(ctx, "pages/index.html", { root: ROOT });
});

router.get("/login", async (ctx) => {
    await send(ctx, "pages/login.html", { root: ROOT });
});

router.get("/register", async (ctx) => {
    await send(ctx, "pages/register.html", { root: ROOT });
});

router.get("/about", async (ctx) => {
    await send(ctx, "pages/about.html", { root: ROOT });
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

if (Deno.args.length < 1) {
    console.log(
        "Usage: $ deno run --allow-net --allow-read=./ src/front_server.ts PORT [CERT_PATH KEY_PATH]",
    );
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

console.log(
    `Oak front server running on port ${listenOptions.port} for files in ${ROOT}`,
);

await app.listen({ ...listenOptions, ...tlsOptions });