import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

const keyOf = (encodedKey: string): Buffer | null => {
  const key = Buffer.from(encodedKey, "base64");
  return key.length === KEY_BYTES ? key : null;
};

export const encryptToken = (plain: string, encodedKey: string): string | null => {
  const key = keyOf(encodedKey);
  if (key === null) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const payload = Buffer.concat([body, cipher.getAuthTag()]);
  return [VERSION, iv.toString("base64"), payload.toString("base64")].join(":");
};

export const decryptToken = (stored: string, encodedKey: string): string | null => {
  const key = keyOf(encodedKey);
  const [version, ivText, payloadText] = stored.split(":");
  if (key === null || version !== VERSION || ivText === undefined || payloadText === undefined) {
    return null;
  }
  try {
    const payload = Buffer.from(payloadText, "base64");
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivText, "base64"));
    decipher.setAuthTag(payload.subarray(payload.length - TAG_BYTES));
    const body = payload.subarray(0, payload.length - TAG_BYTES);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};
