import { Context, Router } from "oak";
import { z } from "zod";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import userRepository from "../Model/Repository/UserRepository.ts";
import { sanitizeUser } from "../Model/DataObjects/User.ts";

const router = new Router({ prefix: "/users" });

// tout est optionnel car on peut modifier juste l'email, ou juste la photo
const UpdateProfileSchema = z.object({
    email: z.string().trim().email({ message: "Format d'email invalide" }).optional(),
    path_profil_picture: z.string().trim().optional(),
});

type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;
// authMiddleware pour s'assurer que l'utilisateur est connecté
router.patch("/me", authMiddleware, async (ctx: Context) => {
    // ctx.state.user rempli par AuthMiddleware
    const currentUser = ctx.state.user;
    
    const data = await ctx.request.body.json();
    let parsedData: UpdateProfileData;

    try {
        parsedData = UpdateProfileSchema.parse(data);
    } catch (err) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, error: err };
        return;
    }

    // Si le user change son email on check que le nouveau n'est pas déjà pris
    if (parsedData.email && parsedData.email !== currentUser.email) {
        const existingByEmail = await userRepository.getByEmail(parsedData.email);
        if (existingByEmail) {
            ctx.response.status = 409;
            ctx.response.body = { success: false, error: "Cet email est déjà utilisé" };
            return;
        }
    }

    try {
        // MaJ de la BD
        const updatedUser = await userRepository.update(
            currentUser.id, 
            parsedData.email, 
            parsedData.path_profil_picture
        );

        if (!updatedUser) {
            throw new Error("Erreur lors de la mise à jour");
        }

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            message: "Profil mis à jour avec succès",
            // On renvoie l'utilisateur avec sa nouvelle URL Minio générée
            user: await sanitizeUser(updatedUser) 
        };
    } catch (err) {
        console.error("Erreur update profil:", err);
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: "Erreur interne du serveur" };
    }
});

export default router;