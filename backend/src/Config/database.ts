import { Client } from "https://deno.land/x/postgres/mod.ts";
import config from "./config.ts";

const client = new Client({
    user: config.dbUser,
    database: config.dbName,
    hostname: config.dbHost,
    port: config.dbPort,
    password: config.dbPassword
});
await client.connect();

export default client;