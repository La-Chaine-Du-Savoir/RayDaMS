class Config {
    readonly allowedOrigins: string[];
    readonly dbHost: string;
    readonly dbPort: number;
    readonly dbName: string;
    readonly dbUser: string;
    readonly dbPassword: string;
    readonly jwtSecret: string;
    readonly redisHost: string;
    readonly redisPort: number;
    readonly redisPassword: string;

    constructor() {
        const rawOrigins = this.getEnv("ALLOWED_ORIGINS", "");

        this.allowedOrigins = rawOrigins
            .split(",")
            .map(origin => origin.trim())
            .filter(origin => origin.length > 0);

        this.dbHost = this.getEnv("DB_HOST", "localhost");
        this.dbPort = this.getNumberEnv("DB_PORT", 5432);
        this.dbName = this.getEnv("DB_NAME", "raydams");
        this.dbUser = this.getEnv("DB_USER", "raydams");
        this.dbPassword = this.getEnv("DB_PASSWORD", "");

        this.jwtSecret = this.getEnv("JWT_SECRET", "");
        if (!this.jwtSecret) {
            console.warn("⚠️  JWT_SECRET not set. Using empty secret (not recommended for production)");
        }

        this.redisHost = this.getEnv("REDIS_HOST", "localhost");
        this.redisPassword = this.getEnv("REDIS_PASSWORD", "");
        this.redisPort = this.getNumberEnv("REDIS_PORT", 6379);
    }

    private getEnv(key: string, defaultValue = ""): string {
        const value = Deno.env.get(key);
        return value !== undefined ? value : defaultValue;
    }

    private getNumberEnv(key: string, defaultValue: number): number {
        const value = this.getEnv(key, "");
        if (value === "") {
            return defaultValue;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    private getBooleanEnv(key: string, defaultValue: boolean): boolean {
        const value = this.getEnv(key, "").toLowerCase();
        if (value === "true" || value === "1") {
            return true;
        }
        if (value === "false" || value === "0") {
            return false;
        }
        return defaultValue;
    }

    get hasOrigins() {
        return this.allowedOrigins.length > 0;
    }
}

const config = new Config();

export default config;