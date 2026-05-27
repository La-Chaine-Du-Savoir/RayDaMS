import { Context } from "oak";

export default async function formDataMiddleware(ctx: Context, next: () => Promise<unknown>) {
    const contentType = ctx.request.headers.get("content-type");

    if (!contentType || !contentType.includes("multipart/form-data")) {
        ctx.response.status = 415;
        ctx.response.body = {
            error: "Unsupported Media Type: Cette route accepte uniquement le format multipart/form-data."
        };
        return;
    }

    await next();
}