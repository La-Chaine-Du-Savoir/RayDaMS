interface Config {
    allowedOrigins: string[];
    jwtSecret?: CryptoKey;
    accessTokenLifetime: number;
    refreshTokenLifetime: number;
    cookieSecure: boolean;
    cookieSamesite: "lax" | "strict" | "none";
    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        name: string;
    };
    redis: {
        host: string;
        port: number;
        password: string;
    };
    s3: {
        user: string;
        password: string;
        port: number;
        publicHost: string;
        endpoint: string;
        bucketName: string;
    }
}

const getEnv = (key: string, defaultValue = ""): string => {
    return Deno.env.get(key) ?? defaultValue;
};

const getNumberEnv = (key: string, defaultValue: number): number => {
    const value = getEnv(key, "");
    if (value === "") return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
};

const getBooleanEnv = (key: string, defaultValue: boolean): boolean => {
    const value = getEnv(key, "")
    if (value === "") return defaultValue;
    const truthyValues = ["true", "1", "yes", "on", 'True'];
    const falsyValues = ["false", "0", "no", "off", 'False'];
    if (truthyValues.includes(value)) return true;
    if (falsyValues.includes(value)) return false;
    return defaultValue;
};

const getSameSiteEnv = (key: string, defaultValue: "lax" | "strict" | "none"): "lax" | "strict" | "none" => {
    // deno-lint-ignore no-explicit-any
    const value = getEnv(key, "").toLowerCase() as any;
    const validValues = ["lax", "strict", "none"];

    if (validValues.includes(value)) {
        return value;
    }
    return defaultValue;
};

const rawOrigins = getEnv("ALLOWED_ORIGINS", "");
const jwtSecretRaw = getEnv("JWT_SECRET", "");

const config: Config = {
    allowedOrigins: rawOrigins
        .split(",")
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0),

    db: {
        host: getEnv("DB_HOST", "localhost"),
        port: getNumberEnv("DB_PORT", 5432),
        user: getEnv("DB_USER", "raydams"),
        password: getEnv("DB_PASSWORD", ""),
        name: getEnv("DB_NAME", "raydams"),
    },

    redis: {
        host: getEnv("REDIS_HOST", "localhost"),
        port: getNumberEnv("REDIS_PORT", 6379),
        password: getEnv("REDIS_PASSWORD", ""),
    },

    s3: {
        user: getEnv("S3_USER", "raydams"),
        password: getEnv("S3_PASSWORD", ""),
        port: getNumberEnv("S3_PORT", 9000),
        publicHost: getEnv("PUBLIC_S3_ENDPOINT", "http://localhost:9000"),
        endpoint: getEnv("S3_ENDPOINT", "minio"),
        bucketName: getEnv("S3_STORAGE_BUCKET_NAME", "raydams"),
    },

    accessTokenLifetime: getNumberEnv("ACCESS_TOKEN_LIFETIME", 15 * 60),
    refreshTokenLifetime: getNumberEnv("REFRESH_TOKEN_LIFETIME", 7 * 24 * 60 * 60),
    cookieSecure: getBooleanEnv("COOKIE_SECURE", true),
    cookieSamesite: getSameSiteEnv("COOKIE_SAMESITE", "lax")
};

if (!jwtSecretRaw) {
    console.warn("JWT_SECRET not set. Using empty secret (not recommended for production)");
}

try {
    config.jwtSecret = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(jwtSecretRaw),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign", "verify"],
    );
} catch (err) {
    console.error("Failed to import JWT CryptoKey:", err);
}

export default config;