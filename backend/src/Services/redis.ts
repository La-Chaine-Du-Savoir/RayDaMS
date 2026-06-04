import { connect, Redis } from "redis";
import config from "../Config/config.ts";

let redis: Redis | undefined;

if (Deno.env.get("DENO_ENV") !== "test") {
  try {
    redis = await connect({
      hostname: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Could not connect to Redis:", err);
    throw err;
  }
} else {
  console.log("Skipping Redis connect in test mode (DENO_ENV=test)");
}

export default redis as Redis;
