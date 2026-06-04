import * as bcrypt from "bcrypt";
import * as crypto from "node:crypto";
import config from "../Config/config.ts";

/**
 * Génère un helper pour combiner le password et le pepper de manière sûre.
 */
function pepperPassword(password: string): string {
  return crypto
    .createHmac("sha256", config.pepperSecret)
    .update(password)
    .digest("hex");
}

/**
 * Hash un mot de passe en utilisant bcrypt.
 *
 * @param password - Le mot de passe en clair.
 * @param saltRounds - Le facteur de coût (défaut: 10).
 * Plus il est élevé, plus le hachage est lent et sécurisé.
 * @returns Une promesse contenant le hash généré.
 */
export async function hashPassword(
  password: string,
  saltRounds: number = 10,
): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(pepperPassword(password), salt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erreur lors du hachage : ${message}`);
  }
}

/**
 * Vérifie si un mot de passe correspond à un hash stocké.
 *
 * @param password - Le mot de passe en clair à vérifier.
 * @param hash - Le hash bcrypt précédemment généré et stocké.
 * @returns Une promesse résolue à true si le mot de passe correspond.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(pepperPassword(password), hash);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erreur lors de la vérification : ${message}`);
  }
}
