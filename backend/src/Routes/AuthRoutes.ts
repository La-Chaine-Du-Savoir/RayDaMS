import { Context, Router } from "oak";

const router = new Router({ prefix: "/auth" });

router.post("/login", async (ctx: Context) => {

})

router.post("/logout", async (ctx: Context) => {
    ctx.cookies.set("access-token", "", {
        maxAge: 0,
        httpOnly: true,
        path: "/",
    });

    ctx.cookies.set("refresh-token", "", {
        maxAge: 0,
        httpOnly: true,
        path: "/auth/token/refresh",
    });

    ctx.response.status = 200;
    ctx.response.body = { message: "Logout successful" };
});

router.post("/register", async (ctx: Context) => {

})

router.post("/token/refresh", async (ctx: Context) => {

})

export default router;