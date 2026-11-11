import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { isDeployed } from "@/lib/app-url";

/**
 * Encrypts secrets stored in the database (the Adeli API key) with AES-256-GCM.
 * The key comes from `BETTER_AUTH_SECRET`, so a database dump alone doesn't
 * reveal the Adeli key. Locally, without that variable, a fixed dev key is used.
 */
const VERSION = "v1";
const LOCAL_SECRET = "adeli-chat-local-development-only";

function encryptionKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret && isDeployed()) throw new Error("BETTER_AUTH_SECRET is not set on this server.");
  return createHash("sha256").update(`adeli-chat:secret-box:${secret || LOCAL_SECRET}`).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

/** Returns null when the value can't be opened, for example after `BETTER_AUTH_SECRET` changed. */
export function openSecret(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
