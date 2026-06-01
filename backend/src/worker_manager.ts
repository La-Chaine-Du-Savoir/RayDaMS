import { Readable } from "node:stream";
import { arrayBuffer } from "node:stream/consumers";
import { Buffer } from "node:buffer";
import tar, { Headers } from "tar-stream";
import { unzipSync } from "fflate";

import redisClient from "./Services/redis.ts";
import { internalS3Client } from "./Services/cloud.ts";
import config from "./Config/config.ts";
import gameRepository from "./Model/Repository/GameRepository.ts";
import Docker from "dockerode";
import { GetObjectCommand, PutObjectCommand } from "client-s3";

// ─── Docker & Configuration ───────────────────────────────────────────────────

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const BUCKET_NAME = config.s3.bucketName || "raydams";
const BUILD_TIMEOUT_MS = parseInt(Deno.env.get("BUILD_TIMEOUT_MS") ?? "300000", 10);
const QUEUE_BRPOP_TIMEOUT_S = 5;
const MAX_UNZIPPED_BYTES = 700 * 1024 * 1024;

const MAX_CONCURRENT_RAW = Deno.env.get("MAX_CONCURRENT") ?? "5";
const maxConcurrent = parseInt(MAX_CONCURRENT_RAW, 10);
if (isNaN(maxConcurrent) || maxConcurrent <= 0) {
    throw new Error(`[Config] MAX_CONCURRENT invalide : "${MAX_CONCURRENT_RAW}". Doit être un entier positif.`);
}

// ─── État global ──────────────────────────────────────────────────────────────

let currentRunningBuilds = 0;
let isShuttingDown = false;

// ─── Utilitaires ──────────────────────────────────────────────────────────────


/**
 * Décompresse un ZIP et l'emballe dans un buffer TAR pour Docker putArchive.
 * Supprime automatiquement un éventuel dossier racine commun.
 */
async function decompressZipToTarBuffer(zipBytes: Uint8Array): Promise<Buffer> {
    let unzippedFiles: Record<string, Uint8Array>;
    try {
        unzippedFiles = unzipSync(zipBytes);
    } catch (err) {
        throw new Error(`Fichier ZIP corrompu ou illisible : ${err instanceof Error ? err.message : String(err)}`);
    }

    const filePaths = Object.keys(unzippedFiles).filter(p => !p.endsWith("/"));

    // Détection et suppression d'un dossier racine commun
    let rootPrefix = "";
    if (filePaths.length > 0) {
        const firstSegment = filePaths[0].split(/[/\\]/)[0];
        const hasCommonRoot = filePaths.every(p => p.startsWith(firstSegment + "/") || p.startsWith(firstSegment + "\\"));
        if (hasCommonRoot) {
            rootPrefix = firstSegment + "/";
            console.log(`ℹ️ [ZIP] Dossier racine commun détecté ("${firstSegment}"), retiré au déploiement.`);
        }
    }

    const pack = tar.pack();
    const tarChunks: Buffer[] = [];
    pack.on("data", (chunk: Buffer) => tarChunks.push(chunk));

    let totalUnzippedBytes = 0;

    for (const [rawPath, fileBytes] of Object.entries(unzippedFiles)) {
        if (rawPath.endsWith("/")) continue;

        if (rawPath.includes("..")) {
            throw new Error(`Sécurité : chemin interdit détecté ("${rawPath}"). Path traversal refusé.`);
        }

        totalUnzippedBytes += fileBytes.length;
        if (totalUnzippedBytes > MAX_UNZIPPED_BYTES) {
            throw new Error(`Zip Bomb détectée : taille dépasse ${MAX_UNZIPPED_BYTES / 1024 / 1024}MB.`);
        }

        let cleanPath = rawPath.replace(/\\/g, "/");
        if (rootPrefix && cleanPath.startsWith(rootPrefix)) {
            cleanPath = cleanPath.substring(rootPrefix.length);
        }
        const relativePath = cleanPath.split("/").filter(Boolean).join("/");
        const fileBuffer = Buffer.from(fileBytes);

        await new Promise<void>((resolve, reject) => {
            pack.entry({ name: relativePath, size: fileBuffer.length }, fileBuffer, (err: unknown) => {
                if (err) reject(err); else resolve();
            });
        });
    }

    pack.finalize();

    return new Promise<Buffer>((resolve, reject) => {
        pack.on("end", () => resolve(Buffer.concat(tarChunks)));
        pack.on("error", reject);
    });
}

// ─── Phases du cycle de build ─────────────────────────────────────────────────

async function downloadProjectZip(s3Key: string): Promise<Uint8Array> {
    const res = await internalS3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
    if (!res.Body) throw new Error("Le fichier ZIP récupéré est vide ou inexistant.");
    return res.Body.transformToByteArray();
}

async function createSandboxContainer(): Promise<Docker.Container> {
    return docker.createContainer({
        Image: "emscripten-raylib-builder:latest",
        Cmd: ["/bin/bash", "-c", "ulimit -f 512000 && /usr/local/bin/build_game.sh"],
        HostConfig: {
            AutoRemove: false,
            Memory: 1024 * 1024 * 1024,
            NanoCpus: 1_000_000_000,
            NetworkMode: "none",
        },
    });
}

/**
 * Lance la compilation et stream les logs en temps réel.
 * Chaque chunk Docker est publié immédiatement dans Redis (et donc transmis
 * au client WS via xread BLOCK) sans attendre la fin de la compilation.
 *
 * On attend Promise.all([wait, drain]) pour garantir que :
 * 1. Tous les logs sont publiés avant d'envoyer __END__
 * 2. Le code de retour du conteneur est vérifié
 */
async function runCompilation(
    container: Docker.Container,
    logFn: (msg: string) => Promise<void>,
): Promise<void> {
    await container.start();
    await logFn("🚀 Compilation en cours (WebAssembly + Raylib)...");

    // Attacher le stream AVANT que le conteneur soit terminé
    const logStream = await container.logs({ stdout: true, stderr: true, follow: true });

    const waitPromise = container.wait() as Promise<{ StatusCode: number }>;

    const drainPromise = (async () => {
        const pending: Promise<void>[] = [];
        for await (const chunk of logStream as unknown as AsyncIterable<Uint8Array>) {
            const text = new TextDecoder()
                .decode(chunk)
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

            for (const line of text.split("\n")) {
                const trimmed = line.trim();
                if (trimmed) pending.push(logFn(trimmed));
            }
        }
        await Promise.all(pending);
    })();

    const [waitResult] = await Promise.all([waitPromise, drainPromise]);

    if (waitResult.StatusCode !== 0) {
        throw new Error(`Le compilateur a retourné un code d'erreur : ${waitResult.StatusCode}`);
    }
}

async function exportBuildArtifacts(container: Docker.Container, gameId: string): Promise<Record<string, string>> {
    const archiveStream = await container.getArchive({ path: "/src/web_build" });

    const UPLOADABLE_FILES = new Set(["index.data", "index.js", "index.wasm"]);
    const CONTENT_TYPES: Record<string, string> = {
        "index.js": "application/javascript",
        "index.wasm": "application/wasm",
        "index.data": "application/octet-stream",
    };

    const uploaded: Record<string, string> = {};
    const uploadPromises: Promise<void>[] = [];

    return new Promise<Record<string, string>>((resolve, reject) => {
        const extract = tar.extract();

        extract.on("entry", (header: Headers, stream: NodeJS.ReadableStream, next: () => void) => {
            const basename = header.name.split("/").at(-1) ?? "";

            if (header.type !== "file" || !UPLOADABLE_FILES.has(basename)) {
                (stream as Readable).resume();
                (stream as Readable).on("end", next);
                return;
            }

            const upload = arrayBuffer(stream as Readable).then(async (buffer) => {
                const s3Key = `games/${gameId}/web_build/${basename}`;
                await internalS3Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    Body: new Uint8Array(buffer),
                    ContentType: CONTENT_TYPES[basename],
                }));
                uploaded[basename] = s3Key;
                console.log(`  ☁️  [Build ${gameId}] Uploadé : ${basename}`);
                next();
            }).catch((err) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });

            uploadPromises.push(upload as Promise<void>);
        });

        extract.on("finish", () => {
            Promise.all(uploadPromises).then(() => resolve(uploaded)).catch(reject);
        });

        extract.on("error", (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

        (archiveStream as unknown as NodeJS.ReadableStream).pipe(extract);
    });
}

async function safelyRemoveContainer(container: Docker.Container | null, gameId: string): Promise<void> {
    if (!container) return;
    await container.remove({ force: true }).catch((err: unknown) => {
        console.warn(`[Build ${gameId}] Impossible de supprimer le conteneur : ${err instanceof Error ? err.message : String(err)}`);
    });
}

// ─── Orchestrateur du build ───────────────────────────────────────────────────

async function compileGame(gameId: string): Promise<void> {
    const logChannel = `logs:${gameId}`;
    const streamKey = `stream:${logChannel}`;

    console.log(`📦 [Build ${gameId}] Début du traitement.`);

    let container: Docker.Container | null = null;

    let streamInitialized = false;

    const log = async (msg: string): Promise<void> => {
        try {
            await redisClient.xadd(streamKey, "*", { message: msg });
            if (!streamInitialized) {
                streamInitialized = true;
                await redisClient.expire(streamKey, 300);
            }
        } catch (err) {
            console.warn(`[Build ${gameId}] Impossible de publier le log : ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const setStatus = async (status: "pending" | "running" | "success" | "failed") => {
        await gameRepository.updateGame(gameId, { status }).catch((err) => {
            console.warn(`[Build ${gameId}] Impossible de mettre à jour le status (${status}) : ${err instanceof Error ? err.message : String(err)}`);
        });
        if (status === "success" || status === "failed") {
            await redisClient.expire(streamKey, 60).catch(() => {});
        }
    };

    try {
        await setStatus("running");

        await log("📥 Récupération du fichier projet depuis MinIO...");
        const game = await gameRepository.getById(gameId);
        if (!game) throw new Error(`Jeu introuvable en base : ${gameId}`);
        if (!game.path_sources) throw new Error(`Aucun chemin de sources configuré pour le jeu ${gameId}`);

        const zipBytes = await downloadProjectZip(game.path_sources);

        await log("🔍 Décompression du ZIP...");
        const tarBuffer = await decompressZipToTarBuffer(zipBytes);

        await log("🔧 Création du conteneur de build...");
        container = await createSandboxContainer();

        await log("📂 Injection des sources dans le conteneur...");
        await container.putArchive(Readable.from(tarBuffer), { path: "/src" });

        await runCompilation(container, log);

        await log("📥 Extraction et upload des artefacts Wasm...");
        const uploaded = await exportBuildArtifacts(container, gameId);

        const updates: Record<string, string> = {};
        if (uploaded["index.js"])   updates.path_js   = uploaded["index.js"];
        if (uploaded["index.wasm"]) updates.path_wasm = uploaded["index.wasm"];
        if (uploaded["index.data"]) updates.path_data = uploaded["index.data"];

        if (Object.keys(updates).length > 0) {
            await gameRepository.updateGame(gameId, updates as any).catch((err) => {
                console.warn(`[Build ${gameId}] Impossible de sauvegarder les chemins d'artefacts : ${err instanceof Error ? err.message : String(err)}`);
            });
        }

        await log("💾 Fichiers uploadés : index.js, index.wasm, index.data");
        await log("=== 🏁 Compilation terminée avec succès ! ===");
        await log("__END__");
        await setStatus("success");

        console.log(`✨ [Build ${gameId}] Terminé avec succès.`);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [Build ${gameId}] Erreur critique :`, msg);
        await log(`❌ Erreur de build : ${msg}`);
        await log("__END__");
        await setStatus("failed");
    } finally {
        await safelyRemoveContainer(container, gameId);
    }
}

async function compileGameWithTimeout(gameId: string): Promise<void> {
    await Promise.race([
        compileGame(gameId),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout : build trop long (>${BUILD_TIMEOUT_MS / 1000}s)`)), BUILD_TIMEOUT_MS)
        ),
    ]);
}

// ─── Queue listener ───────────────────────────────────────────────────────────

async function startQueueListener(): Promise<void> {
    console.log(`[Queue] En écoute sur "queue:builds" (max ${maxConcurrent} builds parallèles)...`);

    while (!isShuttingDown) {
        if (currentRunningBuilds >= maxConcurrent) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }

        try {
            const task = await redisClient.brpop(QUEUE_BRPOP_TIMEOUT_S, "queue:builds");
            if (!task || task.length < 2) continue;

            const gameId = task[1];
            console.log(`[Queue] Tâche dépilée : ${gameId} (${currentRunningBuilds + 1}/${maxConcurrent})`);
            currentRunningBuilds++;

            (async () => {
                try {
                    await compileGameWithTimeout(gameId);
                } catch (err) {
                    console.error(`[Queue] Build échoué pour ${gameId} :`, err instanceof Error ? err.message : String(err));
                } finally {
                    currentRunningBuilds--;
                    console.log(`[Queue] Slot libéré (${currentRunningBuilds}/${maxConcurrent})`);
                }
            })();

        } catch (err) {
            if (!isShuttingDown) {
                console.error("[Queue] Erreur lors du dépilage :", err instanceof Error ? err.message : String(err));
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    console.log("👋 Queue listener arrêté.");
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function setupGracefulShutdown() {
    for (const signal of ["SIGTERM", "SIGINT"]) {
        process.on(signal, async () => {
            console.log(`\nSignal ${signal} reçu, arrêt en cours...`);
            isShuttingDown = true;

            let waited = 0;
            while (currentRunningBuilds > 0 && waited < 300) {
                console.log(`⏳ Attente de ${currentRunningBuilds} build(s) en cours... (${waited + 1}/300)`);
                await new Promise(r => setTimeout(r, 1000));
                waited++;
            }

            if (currentRunningBuilds > 0) {
                console.warn(`⚠️  Timeout atteint, ${currentRunningBuilds} build(s) encore en cours.`);
            } else {
                console.log("✨ Tous les builds terminés.");
            }

            process.exit(0);
        });
    }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

console.log(`[Worker] Initialisé. Concurrence max : ${maxConcurrent} | Timeout : ${BUILD_TIMEOUT_MS / 1000}s`);

setupGracefulShutdown();
startQueueListener();