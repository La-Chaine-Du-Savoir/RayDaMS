import { Application, Router} from "https://deno.land/x/oak@v17.1.6/mod.ts"
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

import config from "./Config/config.ts"

const router = new Router();
const app = new Application();

if (Deno.args.length < 1) {
    console.log(`Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`);
    Deno.exit();
}

const options = {port: Deno.args[0]}

if (Deno.args.length >= 3) {
    options.secure = true;
    options.cert = await Deno.readTextFile(Deno.args[1]);
    options.key = await Deno.readTextFile(Deno.args[2]);
    console.log(`SSL conf ready (use https)`);
}

console.log(`Oak back server running on port ${options.port}`);

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
await app.listen(options);