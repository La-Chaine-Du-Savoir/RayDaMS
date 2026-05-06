class Config {
    constructor() {
        const rawOrigins = Deno.env.get("ALLOWED_ORIGINS") || "";

        this.allowedOrigins = rawOrigins
            .split(",")
            .map(origin => origin.trim())
            .filter(origin => origin.length > 0);
    }

    get hasOrigins() {
        return this.allowedOrigins.length > 0;
    }
}

const config = new Config();

export default config;