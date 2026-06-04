import { Client } from "postgres";
import config from "../Config/config.ts";

const client = new Client({
  user: config.db.user,
  database: config.db.name,
  hostname: config.db.host,
  port: config.db.port,
  password: config.db.password,
});
await client.connect();

console.log("Connected to Database");

export default client;
