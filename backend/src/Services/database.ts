import { Client } from "postgres";
import config from "../Config/config.ts";

const client = new Client({
  user: config.db.user,
  database: config.db.name,
  hostname: config.db.host,
  port: config.db.port,
  password: config.db.password,
});

if (Deno.env.get("DENO_ENV") !== "test") {
  await client.connect();
  console.log("Connected to Database");
} else {
  console.log("Skipping database connect in test mode (DENO_ENV=test)");
}

export default client;
