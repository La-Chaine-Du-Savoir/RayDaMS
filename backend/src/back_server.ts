import { Application, Router } from "oak";
import { oakCors } from "cors";
import authRoutes from "./Routes/AuthRoutes.ts"

import config from "./Config/config.ts"

const router = new Router();
const app = new Application();

router.use(authRoutes.routes());

if (Deno.args.length < 1) {
    console.log(`Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`);
    Deno.exit();
}

const listenOptions: Deno.ListenOptions = {
    port: Number(Deno.args[0]),
};
const tlsOptions: { cert?: string; key?: string } = {};

if (Deno.args.length >= 3) {
    tlsOptions.cert = await Deno.readTextFile(Deno.args[1]);
    tlsOptions.key = await Deno.readTextFile(Deno.args[2]);
    console.log(`SSL conf ready (use https)`);
}

console.log(`Oak back server running on port ${listenOptions.port}`);

app.use(
    oakCors({
        origin: config.allowedOrigins,
        methods: ["GET", "POST", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);
console.log(`CORS allows origin ${config.allowedOrigins}`);

app.use(router.routes());
app.use(router.allowedMethods())
await app.listen({ ...listenOptions, ...tlsOptions });