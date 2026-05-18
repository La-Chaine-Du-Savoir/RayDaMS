import { connect, Redis } from "redis";
import config from "../Config/config.ts";

let redis: Redis;

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

export default redis;