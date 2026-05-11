import { Client } from "postgres";
import config from "../Config/config.ts";

const client = new Client({
    user: config.dbUser,
    database: config.dbName,
    hostname: config.dbHost,
    port: config.dbPort,
    password: config.dbPassword
});
await client.connect();

console.log("Connected to Database");

export default client;