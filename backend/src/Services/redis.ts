import { connect, Redis } from "redis";
import config from "../Config/config.ts";

let redis: Redis;

try {
    redis = await connect({
        hostname: config.redisHost,
        port: config.redisPort,
        password: config.redisPassword,
    });
    console.log("Connected to Redis");
} catch (err) {
    console.error("Could not connect to Redis:", err);
    throw err;
}

export default redis;