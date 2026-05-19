import { S3Client, GetObjectCommand, PutObjectCommand } from "client-s3";
import { getSignedUrl } from "s3-request-presigner";
import config from "../Config/config.ts";

const BUCKET_NAME = config.s3.bucketName || "raydams";

// Client interne : quand le backend Deno fait des actions directes sur minio (réseau Docker)
export const internalS3Client = new S3Client({
    // Région pas importante mais obligatoire, sinon le SDK AWS plante en pensant qu'il manque de configuration
    region: "us-east-1",
    endpoint: `http://${config.s3.endpoint}:${config.s3.port}`, // http://minio:9000
    credentials: {
        accessKeyId: config.s3.user!,
        secretAccessKey: config.s3.password!,
    },
    // force l'URL en mode http://domain/bucket plutot que http://bucket.domain (DNS local saurait pas résoudre)
    forcePathStyle: true,
});

// Client public : Utilisé que pour la génération d'URL présignées destinées au front
export const publicS3Client = new S3Client({
    region: "us-east-1",
    // On met l'URL publique pour que la signature cryptographique matche le domaine final
    endpoint: config.s3.publicHost, //http://localhost:9000
    credentials: {
        accessKeyId: config.s3.user!,
        secretAccessKey: config.s3.password!,
    },
    forcePathStyle: true,
});

const cloud = {
    /**
     * Génère une URL pré-signée pour le client.
     * @param path Le chemin/nom du fichier dans le bucket (ex: "users/avatar.png")
     * @param lifetime La durée de validité de l'URL en secondes
     * @param action "download" (pour lire) ou "upload" (pour écrire)
     * @returns L'URL publique sous forme de string
     */
    async getPresigned(path: string, lifetime: number, action: "download" | "upload" = "download"): Promise<string> {
        const commandParams = {
            Bucket: BUCKET_NAME,
            Key: path,
        };

        const command = action === "upload" 
            ? new PutObjectCommand(commandParams) 
            : new GetObjectCommand(commandParams);

        return await getSignedUrl(publicS3Client, command, { expiresIn: lifetime });
    }
};

export default cloud;