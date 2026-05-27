import { Context, Router } from "oak";
import { z } from "zod";
import authMiddleware from "../Middlewares/AuthMiddleware.ts";
import userRepository from "../Model/Repository/UserRepository.ts";
import groupRepository from "../Model/Repository/GroupRepository.ts";
import { sanitizeUser } from "../Model/DataObjects/User.ts";
import cloud from "../Services/cloud.ts";

const router = new Router({ prefix: "/users" });

const EmailSchema = z.string().trim().email({ message: "Format d'email invalide" }).optional();

// authMiddleware pour s'assurer que l'utilisateur est connecté
router.patch("/me", authMiddleware, async (ctx: Context) => {
    // ctx.state.user rempli par AuthMiddleware
    const currentUser = ctx.state.user;
    
    // Vérifier que c'est bien du form-data
    const contentType = ctx.request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
        ctx.response.status = 400;
        ctx.response.body = { success: false, error: "Content-Type doit être multipart/form-data" };
        return;
    }

    try {
        const formData = await ctx.request.body.formData();

        // Mail
        const emailField = formData.get("email");
        // On s'assure que c'est bien une string
        let newEmail: string | undefined = typeof emailField === "string" ? emailField : undefined;
        
        if (newEmail) {
            const parseResult = EmailSchema.safeParse(newEmail);
            if (!parseResult.success) {
                ctx.response.status = 400;
                ctx.response.body = { success: false, error: "Format d'email invalide" };
                return;
            }
            
            if (newEmail !== currentUser.email) {
                const existingByEmail = await userRepository.getByEmail(newEmail);
                if (existingByEmail) {
                    ctx.response.status = 409;
                    ctx.response.body = { success: false, error: "Cet email est déjà utilisé" };
                    return;
                }
            } else {
                newEmail = undefined; 
            }
        }

        // Photo de profil
        let newPathProfilPicture: string | undefined = undefined;
        
        // formData.get renvoie directement l'objet File complet
        const avatarFile = formData.get("avatar");

        // On vérifie que le champ existe ET que c'est bien un fichier
        if (avatarFile && typeof avatarFile === "object" && "name" in avatarFile) {
            
            // Limite 5 Mo
            if (avatarFile.size > 5 * 1024 * 1024) {
                ctx.response.status = 413;
                ctx.response.body = { success: false, error: "L'image dépasse la limite de 5 Mo." };
                return;
            }

            // Vérification de sécurité du type de fichier
            const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
            if (!allowedTypes.includes(avatarFile.type)) {
                ctx.response.status = 400;
                ctx.response.body = { success: false, error: "Format d'image non autorisé (JPG, PNG, WEBP uniquement)" };
                return;
            }

            // génère un chemin unique
            const extension = avatarFile.name.split('.').pop();
            const fileKey = `avatars/${currentUser.id}-${crypto.randomUUID()}.${extension}`;

            // On lit le fichier en mémoire vive
            const arrayBuffer = await avatarFile.arrayBuffer();
            const fileContent = new Uint8Array(arrayBuffer);
            
            // On l'envoie à Minio
            await cloud.uploadFile(fileKey, fileContent, avatarFile.type);
            
            newPathProfilPicture = fileKey;

            // supprime l'ancienne image de Minio si elle existe 
            if (currentUser.path_profil_picture) {
                try {
                    await cloud.deleteFile(currentUser.path_profil_picture);
                } catch (e) {
                    console.error("Impossible de supprimer l'ancienne image:", e);
                }
            }
        }

        // Sauvegarde de la bd
        if (!newEmail && !newPathProfilPicture) {
            ctx.response.status = 200;
            ctx.response.body = {
                success: true,
                message: "Aucune modification détectée",
                user: await sanitizeUser(currentUser)
            };
            return;
        }

        const updatedUser = await userRepository.update(
            currentUser.id, 
            newEmail, 
            newPathProfilPicture
        );

        if (!updatedUser) {
            throw new Error("Erreur lors de la mise à jour");
        }

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            message: "Profil mis à jour avec succès",
            user: await sanitizeUser(updatedUser) 
        };

    } catch (err) {
        console.error("Erreur update profil:", err);
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: "Erreur interne du serveur" };
    }
});

// Récup les groups du user connecté
router.get("/me/groups", authMiddleware, async (ctx: Context) => {
    const currentUser = ctx.state.user;

    try {
        // On fait appel au repository pour récupérer que les groupes de ce user
        const userGroups = await groupRepository.getGroupsByUserId(currentUser.id);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            // On renvoie "results" pour matcher avec apiService.getAll
            results: userGroups 
        };
    } catch (err) {
        console.error("Erreur lors de la récupération des groupes de l'utilisateur:", err);
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: "Erreur interne du serveur" };
    }
});

export default router;