import { Readable } from "node:stream";
import { arrayBuffer } from "node:stream/consumers";
import { Buffer } from "node:buffer";
import tar, { Headers } from "tar-stream";
import unzipper from "unzipper";

import redisClient from "./Services/redis.ts";
import { internalS3Client } from "./Services/cloud.ts";
import config from "./Config/config.ts";
import gameRepository from "./Model/Repository/GameRepository.ts";
import Docker from "dockerode";
import { GetObjectCommand, PutObjectCommand } from "client-s3";

// ─── Initialisation Docker ────────────────────────────────────────────────────

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// ─── Configuration ────────────────────────────────────────────────────────────

const BUCKET_NAME = config.s3.bucketName || "raydams";

const MAX_CONCURRENT_RAW = Deno.env.get("MAX_CONCURRENT") ?? "5";
const maxConcurrent = parseInt(MAX_CONCURRENT_RAW, 10);
if (isNaN(maxConcurrent) || maxConcurrent <= 0) {
    throw new Error(
        `[Config] MAX_CONCURRENT invalide : "${MAX_CONCURRENT_RAW}". Doit être un entier positif.`,
    );
}

// Limite de décompression ZIP pour prévenir les zip bombs
// Valeur : 700 MB (correspond à la limite de la sandbox Docker)
const BUILD_TIMEOUT_MS = parseInt(Deno.env.get("BUILD_TIMEOUT_MS") ?? "300000", 10);
const QUEUE_BRPOP_TIMEOUT_S = 5;
const MAX_UNZIPPED_BYTES = 700 * 1024 * 1024;

// ─── État global ──────────────────────────────────────────────────────────────

let currentRunningBuilds = 0;
let isShuttingDown = false;

// ─── Circuit Breaker Pattern ──────────────────────────────────────────────────

class CircuitBreaker {
    private failureCount = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private nextRetryTime = 0;

    constructor(
        private failureThreshold = 5,
        private resetTimeout = 60000 // 60s
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextRetryTime) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error(`Circuit breaker is OPEN, retry in ${Math.ceil((this.nextRetryTime - Date.now()) / 1000)}s`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    private onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextRetryTime = Date.now() + this.resetTimeout;
            console.error(`⚠️ Circuit breaker OPEN for ${this.resetTimeout}ms`);
        }
    }
}

const dockerBreaker = new CircuitBreaker(5, 60000);

// ─── Utilitaires de traitement des flux ───────────────────────────────────────

/**
 * Nettoie les en-têtes binaires de multiplexage injectés par Docker
 * dans les flux stdout/stderr, pour éviter de corrompre le terminal frontend.
 */
function cleanDockerLog(chunk: Uint8Array): string {
    return new TextDecoder()
        .decode(chunk)
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        .trim();
}

/**
 * Extrait le ZIP complet reçu de MinIO et l'emballe à la volée dans un flux TAR
 * compréhensible par l'API putArchive de Docker. Tout se passe en mémoire.
 */
async function decompressZipToTarBuffer(zipBytes: Uint8Array): Promise<Buffer> {
    const pack = tar.pack();
    const tarChunks: Buffer[] = [];

    pack.on("data", (chunk: Buffer) => tarChunks.push(chunk));

    const zipStream = Readable.from(Buffer.from(zipBytes));
    const zip = zipStream.pipe(unzipper.Parse({ forceStream: true }));

    let totalUnzippedBytes = 0;

    for await (const entry of zip) {
        const rawPath: string = entry.path;
        const type: string = entry.type;

        if (type === "Directory") {
            entry.autodrain();
            continue;
        }

        if (rawPath.includes("..")) {
            entry.autodrain();
            throw new Error(`Sécurité : chemin interdit détecté ("${rawPath}"). Path traversal refusé.`);
        }

        const relativePath = rawPath.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
        const fileBuffer = await entry.buffer();

        totalUnzippedBytes += fileBuffer.length;
        if (totalUnzippedBytes > MAX_UNZIPPED_BYTES) {
            throw new Error(`Zip Bomb détectée : la taille dépasse la limite autorisée (${MAX_UNZIPPED_BYTES / 1024 / 1024}MB).`);
        }

        await new Promise<void>((resolve, reject) => {
            pack.entry({ name: relativePath, size: fileBuffer.length }, fileBuffer, (err: Error | null | undefined) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    pack.finalize();

    return await new Promise<Buffer>((resolve, reject) => {
        pack.on("end", () => resolve(Buffer.concat(tarChunks)));
        pack.on("error", reject);
    });
}

// ─── Fonctions Atomiques du Cycle de Build (SRP) ─────────────────────────────

/**
 * Phase 1 : Récupération du fichier ZIP d'origine depuis le stockage Object Storage.
 */
async function downloadProjectZip(s3Key: string): Promise<Uint8Array> {
    try {
        const getObjRes = await internalS3Client.send(
            new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            }),
        );

        if (!getObjRes.Body) {
            throw new Error("Le fichier ZIP récupéré est vide ou inexistant.");
        }
        return await getObjRes.Body.transformToByteArray();
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`[Échec MinIO Read] Fichier source introuvable ou problème de stockage : ${m}`);
    }
}

/**
 * Phase 2 : Décompression et transformation du projet en Buffer TAR.
 */
async function prepareTarArchive(zipBytes: Uint8Array): Promise<Buffer> {
    try {
        return await decompressZipToTarBuffer(zipBytes);
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`[Échec Validation ZIP] Structure invalide ou fichier corrompu : ${m}`);
    }
}

/**
 * Phase 3 : Instanciation de la Sandbox Docker sécurisée par Sysbox.
 * Utilise un circuit breaker pour éviter les cascades d'erreur.
 */
async function createSandboxContainer(): Promise<Docker.Container> {
    return dockerBreaker.execute(async () => {
        try {
            return await docker.createContainer({
                Image: "emscripten-raylib-builder:latest",
                Cmd: ["/bin/bash", "-c", "ulimit -f 512000 && /usr/local/bin/build_game.sh"],
                HostConfig: {
                    AutoRemove: false,
                    // Limites de ressource Docker pour la sandbox :
                    // - Mémoire : 1 GB (pour Emscripten + Raylib)
                    // - CPU : 1 core (NanoCpus = 1_000_000_000)
                    Memory: 1024 * 1024 * 1024,
                    NanoCpus: 1_000_000_000,
                    NetworkMode: "none",
                },
            });
        } catch (err: unknown) {
            const m = err instanceof Error ? err.message : String(err);
            throw new Error(`[Échec Infrastructure] Impossible de créer l'environnement de build : ${m}`);
        }
    });
}

/**
 * Phase 4 : Injection des sources décompressées dans le conteneur.
 */
async function injectSources(container: Docker.Container, tarBuffer: Buffer): Promise<void> {
    try {
        await container.putArchive(Readable.from(tarBuffer), { path: "/src" });
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`[Échec Isolation] Impossible d'injecter le projet dans le bac à sable : ${m}`);
    }
}

/**
 * Phase 5 : Exécution du script de compilation et routage des logs temps réel.
 */
async function runCompilation(container: Docker.Container, logFn: (msg: string) => Promise<unknown>): Promise<void> {
    try {
        await container.start();
        await logFn("🚀 Compilation en cours (WebAssembly + Raylib)...");

        const logStream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
        });

        for await (const chunk of logStream) {
            const cleanText = cleanDockerLog(chunk);
            if (cleanText) {
                await logFn(cleanText);
            }
        }

        const waitData = await container.wait();
        if (waitData.StatusCode !== 0) {
            throw new Error(`Le compilateur a retourné un code d'erreur : ${waitData.StatusCode}`);
        }
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`[Échec Compilation] ${m}`);
    }
}

/**
 * Phase 6 : Récupération des livrables compilés et téléversement vers MinIO.
 */
async function exportBuildArtifacts(container: Docker.Container, gameId: string): Promise<Record<string, string>> {
    try {
        const archiveStream = await container.getArchive({ path: "/src/web_build" });

        const UPLOADABLE_FILES = new Set(["index.data", "index.js", "index.wasm"]);
        const CONTENT_TYPES: Record<string, string> = {
            "index.js": "application/javascript",
            "index.wasm": "application/wasm",
            "index.data": "application/octet-stream",
        };

        const uploaded: Record<string, string> = {};

        return await new Promise<Record<string, string>>((resolve, reject) => {
            const extract = tar.extract();

            extract.on("entry", (header: Headers, stream: NodeJS.ReadableStream, next: () => void) => {
                const basename = header.name.split("/").at(-1) ?? "";

                if (header.type !== "file" || !UPLOADABLE_FILES.has(basename)) {
                    (stream as Readable).resume();
                    (stream as Readable).on("end", next);
                    return;
                }

                arrayBuffer(stream as Readable)
                    .then((buffer) => {
                        const fileBytes = new Uint8Array(buffer);
                        const s3Key = `games/${gameId}/web_build/${basename}`;

                        return internalS3Client.send(
                            new PutObjectCommand({
                                Bucket: BUCKET_NAME,
                                Key: s3Key,
                                Body: fileBytes,
                                ContentType: CONTENT_TYPES[basename],
                            }),
                        ).then(() => s3Key);
                    })
                    .then((s3Key) => {
                        console.log(`  ☁️  [Build ${gameId}] Uploadé : ${basename}`);
                        uploaded[basename] = s3Key as string;
                        next();
                    })
                    .catch((err: unknown) => {
                        reject(err instanceof Error ? err : new Error(String(err)));
                    });
            });

            extract.on("finish", resolve);
            extract.on("error", (err: unknown) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });

            (archiveStream as unknown as NodeJS.ReadableStream).pipe(extract);
        });
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        throw new Error(`[Échec MinIO Export] Impossible de sauvegarder les binaires compilés : ${m}`);
    }
}

/**
 * Nettoyage impératif des ressources d'infrastructure (appelé dans le finally).
 */
async function safelyRemoveContainer(container: Docker.Container | null, gameId: string): Promise<void> {
    if (!container) return;
    await container.remove({ force: true }).catch((err: unknown) => {
        const m = err instanceof Error ? err.message : String(err);
        console.warn(`[Build ${gameId}] Impossible de supprimer le conteneur : ${m}`);
    });
}

// ─── Orchestrateur Principal ──────────────────────────────────────────────────

/**
 * Gère le cycle de vie complet d'un build en orchestrant les fonctions atomiques.
 */
async function compileGame(gameId: string): Promise<void> {
    const logChannel = `logs:${gameId}`;
    console.log(`📦 [Build ${gameId}] Début du traitement.`);

    let container: Docker.Container | null = null;

    const log = async (msg: string) => {
        try {
            const streamKey = `stream:${logChannel}`;
            await redisClient.xadd(streamKey, "*", { message: msg });
            await redisClient.expire(streamKey, 300);
            await redisClient.publish(logChannel, msg);
        } catch (err: unknown) {
            const m = err instanceof Error ? err.message : String(err);
            console.warn(`[Build ${gameId}] Impossible de publier le log : ${m}`);
        }
    };

    const setStatusAndCleanupLogs = async (status: "pending" | "running" | "success" | "failed") => {
        await gameRepository.updateGame(gameId, { status }).catch((err: unknown) => {
            const m = err instanceof Error ? err.message : String(err);
            console.warn(`[Build ${gameId}] Impossible de mettre à jour le status (${status}) : ${m}`);
        });

        if (status === "success" || status === "failed") {
            const streamKey = `stream:${logChannel}`;
            await redisClient.expire(streamKey, 60).catch((err: unknown) => {
                const m = err instanceof Error ? err.message : String(err);
                console.warn(`[Build ${gameId}] Impossible de réduire l'expiration des logs : ${m}`);
            });
        }
    };

    try {
        await setStatusAndCleanupLogs("running");

        // 1. Récupération des données sources
        await log("📥 Récupération du fichier projet depuis MinIO...");
        const game = await gameRepository.getById(gameId);
        if (!game) throw new Error(`Jeu introuvable en base: ${gameId}`);
        if (!game.path_sources) throw new Error(`Aucun chemin de sources configuré pour le jeu ${gameId}`);

        const zipBytes = await downloadProjectZip(game.path_sources);

        // 2. Préparation des fichiers en mémoire
        await log("🔍 Décompression du zip...");
        const tarBuffer = await prepareTarArchive(zipBytes);

        // 3. Création du conteneur
        await log("🔧 Création du conteneur de build...");
        container = await createSandboxContainer();

        // 4. Transfert des fichiers dans le conteneur
        await injectSources(container, tarBuffer);

        // 5. Build
        await runCompilation(container, log);

        // 6. Extraction et stockage des résultats
        await log("📥 Extraction et upload des artefacts Wasm...");
        const uploaded = await exportBuildArtifacts(container, gameId);

        // Enregistrer les chemins des artefacts en base si présents
        const updates: Partial<Record<string, string>> = {};
        if (uploaded["index.js"]) updates.path_js = uploaded["index.js"];
        if (uploaded["index.wasm"]) updates.path_wasm = uploaded["index.wasm"];
        if (uploaded["index.data"]) updates.path_data = uploaded["index.data"];

        if (Object.keys(updates).length > 0) {
            await gameRepository.updateGame(gameId, updates as any).catch((err: unknown) => {
                const m = err instanceof Error ? err.message : String(err);
                console.warn(`[Build ${gameId}] Impossible de sauvegarder les chemins d'artefacts : ${m}`);
            });
        }

        // Clôture nominale
        await log("💾 Fichiers uploadés : index.js, index.wasm, index.data");
        await log("=== 🏁 Compilation terminée avec succès ! ===");
        await log("__END__");
        await setStatusAndCleanupLogs("success");
        console.log(`✨ [Build ${gameId}] Traité et sauvegardé.`);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ [Build ${gameId}] Erreur critique :`, errorMessage);

        await log(`❌ Erreur de build : ${errorMessage}`);
        await log("__END__");
        await setStatusAndCleanupLogs("failed");

    } finally {
        await safelyRemoveContainer(container, gameId);
    }
}

// ─── Gestionnaire de file d'attente (Queue Manager) avec timeout ─────────────

async function compileGameWithTimeout(gameId: string): Promise<void> {
    const buildPromise = compileGame(gameId);
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
            () => reject(new Error(`Timeout: build took more than ${BUILD_TIMEOUT_MS / 1000}s`)),
            BUILD_TIMEOUT_MS
        );
    });

    await Promise.race([buildPromise, timeoutPromise]);
}

/**
 * FIX CRITIQUE : Queue listener avec gestion correcte de l'état de concurrence
 */
async function startQueueListener(): Promise<void> {
    console.log(`👂 [Queue Manager] En écoute sur "queue:builds"...`);

    while (!isShuttingDown) {
        if (currentRunningBuilds >= maxConcurrent) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
        }

        try {
            const task = await redisClient.brpop(QUEUE_BRPOP_TIMEOUT_S, "queue:builds");

            if (!task || task.length < 2) continue;

            const gameId = task[1];
            console.log(`🎯 [Queue Manager] Tâche dépilée : ${gameId} (slots : ${currentRunningBuilds + 1}/${maxConcurrent})`);

            // FIX CRITIQUE : Incrémenter avant d'attendre, utiliser async IIFE
            currentRunningBuilds++;

            (async () => {
                try {
                    await compileGameWithTimeout(gameId);
                } catch (err: unknown) {
                    const m = err instanceof Error ? err.message : String(err);
                    console.error(`❌ [Queue Manager] Build échoué pour ${gameId}: ${m}`);

                    // Re-queue si c'est un problème réseau/circuit breaker
                    if (m.includes("Circuit breaker") || m.includes("OPEN")) {
                        console.log(`♻️  [Queue Manager] Requeueing ${gameId}...`);
                        await redisClient.lpush("queue:builds", gameId);
                    }
                } finally {
                    currentRunningBuilds--;
                    console.log(`🔓 [Queue Manager] Slot libéré (slots : ${currentRunningBuilds}/${maxConcurrent})`);
                }
            })();

        } catch (err: unknown) {
            if (!isShuttingDown) {
                const queueErrorMessage = err instanceof Error ? err.message : String(err);
                console.error("🚨 [Queue Manager] Erreur lors du dépilage :", queueErrorMessage);
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    console.log('👋 Queue listener stopped');
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
        process.on(signal, async () => {
            console.log(`\n📛 Received ${signal}, initiating graceful shutdown...`);
            isShuttingDown = true;

            // Attendre que les builds en cours se terminent
            let waitCount = 0;
            while (currentRunningBuilds > 0 && waitCount < 300) { // Max 5 minutes
                console.log(`⏳ Waiting for ${currentRunningBuilds} build(s) to finish... (${waitCount + 1}/300)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                waitCount++;
            }

            if (currentRunningBuilds > 0) {
                console.warn(`⚠️  Shutdown timeout reached, ${currentRunningBuilds} build(s) still running`);
            } else {
                console.log('✨ All builds completed');
            }

            process.exit(0);
        });
    });
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

console.log(
    `🚀 [Worker Manager] Initialisé. Concurrence max : ${maxConcurrent} | Timeout build : ${BUILD_TIMEOUT_MS / 1000}s`,
);

setupGracefulShutdown();
startQueueListener();