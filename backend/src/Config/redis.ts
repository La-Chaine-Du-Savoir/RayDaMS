import { connect } from "https://deno.land/x/redis@v0.34.0/mod.ts";
import config from "./config.ts";

const redis = await connect({
    hostname: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
});

console.log("Connected to Redis");

export default redis;