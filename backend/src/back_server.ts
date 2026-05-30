import { Application, Router } from "oak";
import { oakCors } from "cors";
import authRoutes from "./Routes/AuthRoutes.ts"
import userRoutes from "./Routes/UserRoutes.ts"
import gameRoutes from "./Routes/GameRoutes.ts";

import config from "./Config/config.ts"
import groupRoutes from "./Routes/GroupRoutes.ts";

const router = new Router();
const args = Deno.args;
const PROXY = args.includes("--proxy");
const app = new Application({ proxy: PROXY });

router.use(authRoutes.routes());
router.use(userRoutes.routes());
router.use(groupRoutes.routes());
router.use(gameRoutes.routes());

const positionalArgs = args.filter(arg => !arg.startsWith("--"));
if (positionalArgs.length < 1) {
    console.log(`Usage: $ deno run --allow-net backend/src/back_server.ts PORT [--proxy] [CERT_PATH KEY_PATH]`);
    Deno.exit();
}

const listenOptions: Deno.ListenOptions = {
    port: Number(positionalArgs[0]),
};
const tlsOptions: { cert?: string; key?: string } = {};

if (positionalArgs.length >= 3) {
    tlsOptions.cert = await Deno.readTextFile(positionalArgs[1]);
    tlsOptions.key = await Deno.readTextFile(positionalArgs[2]);
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
console.log(`CORS allows origin ${config.allowedOrigins.join(", ")}`);

app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ ...listenOptions, ...tlsOptions });