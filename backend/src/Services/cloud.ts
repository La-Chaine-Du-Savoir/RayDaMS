import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "client-s3";
import { getSignedUrl } from "s3-request-presigner";
import { createPresignedPost } from "s3-presigned-post";
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
  async getPresigned(
    path: string,
    lifetime: number,
    action: "download" | "upload" = "download",
  ): Promise<string> {
    const commandParams = {
      Bucket: BUCKET_NAME,
      Key: path,
    };

    const command = action === "upload"
      ? new PutObjectCommand(commandParams)
      : new GetObjectCommand(commandParams);

    return await getSignedUrl(publicS3Client, command, { expiresIn: lifetime });
  },

  /**
   * Upload directement un fichier vers MinIO depuis le serveur Deno.
   * @param path Le chemin d'enregistrement (ex: "avatars/123-photo.png")
   * @param fileData Le contenu du fichier
   * @param contentType Le type MIME (ex: "image/png")
   */
  async uploadFile(
    path: string,
    fileData: Uint8Array | ArrayBuffer,
    contentType: string,
  ): Promise<void> {
    const commandParams = {
      Bucket: BUCKET_NAME,
      Key: path,
      Body: new Uint8Array(fileData), // S3 prend les données sous forme de buffer
      ContentType: contentType,
    };

    // internalS3Client car Deno (réseau Docker) fait l'action directe
    await internalS3Client.send(new PutObjectCommand(commandParams));
  },

  /**
   * Supprime un fichier sur Minio
   * @param path Le chemin exact du fichier
   */
  async deleteFile(path: string): Promise<void> {
    const commandParams = {
      Bucket: BUCKET_NAME,
      Key: path,
    };

    // internalS3Client pour la suppression
    await internalS3Client.send(new DeleteObjectCommand(commandParams));
  },

  /**
   * Téléverse un fichier binaire directement vers le Cloud S3
   * @param path Le chemin cible dans le bucket
   * @param body Les octets du fichier (Uint8Array)
   * @param contentType Le type MIME du fichier
   */
  async upload(
    path: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: path,
      Body: body,
      ContentType: contentType,
    });

    await internalS3Client.send(command);
  },

  /**
   * Génère un formulaire POST pré-signé
   * @param path Le chemin exact où le fichier sera stocké
   * @param maxSizeBytes La taille maximale autorisée pour le fichier (en octets)
   * @param allowedMimeTypes Tableau des types MIME acceptés (ex: ["application/zip"])
   * @param lifetime Durée de validité du formulaire en secondes (default: 15min)
   */
  async getPresignedPostForm(
    path: string,
    maxSizeBytes: number,
    allowedMimeTypes: string[],
    lifetime = 900,
  ) {
    const conditions: unknown[] = [
      ["content-length-range", 0, maxSizeBytes],
      { bucket: BUCKET_NAME },
      { key: path },
    ];

    if (allowedMimeTypes.length === 1) {
      conditions.push({ "Content-Type": allowedMimeTypes[0] });
    } else if (allowedMimeTypes.length > 1) {
      conditions.push(["starts-with", "$Content-Type", ""]);
    }

    const fields: Record<string, string> = {
      "success_action_status": "201",
    };

    if (allowedMimeTypes.length === 1) {
      fields["Content-Type"] = allowedMimeTypes[0];
    }

    const postForm = await createPresignedPost(publicS3Client, {
      Bucket: BUCKET_NAME,
      Key: path,
      Expires: lifetime,
      Conditions: conditions,
      Fields: fields,
    });

    return {
      url: postForm.url,
      fields: postForm.fields,
    };
  },

  /**
   * Vérifie l'existence d'un objet dans le bucket.
   * @param path Le chemin/clé de l'objet dans le bucket
   * @returns true si l'objet existe, false si l'objet est absent
   * @throws Laisse remonter les erreurs inattendues pour que l'appelant puisse les distinguer
   */
  async exists(path: string): Promise<boolean> {
    try {
      await internalS3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: path }),
      );
      return true;
    } catch (err) {
      const status =
        (err as unknown as { $metadata?: { httpStatusCode?: number } })
          ?.$metadata?.httpStatusCode;
      if (status === 404) {
        return false;
      }
      throw err;
    }
  },

  /**
   * Supprime un objet du bucket.
   * @param path Le chemin/clé de l'objet à supprimer
   */
  async delete(path: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: path });
    await internalS3Client.send(command);
  },
};

export default cloud;
