import { inspectImage, inspectMp4 } from "@/lib/shared/media/image-info";
import { MAX_DERIVATIVE_BYTES, MAX_PIXELS, MediaKind, kindOfMime } from "@/lib/shared/media/limits";
import { inspectPdf } from "@/lib/shared/media/pdf-info";
import type { ServerStorage } from "@/lib/shared/storage/types";

const HEAD_BYTES = 65_535;
const TAIL_BYTES = 2048;

export type UploadedVersion = {
  storageKey: string;
  thumbKey: string | null;
  displayKey: string | null;
  mimeType: string;
  sizeBytes: number;
};

export type UploadValidation =
  | {
      ok: true;
      checksum: string;
      width: number | null;
      height: number | null;
      derivativeBytes: number;
    }
  | { ok: false; code: "upload_size_mismatch" | "upload_content_mismatch" | "storage_unavailable" };

const failure = (
  code: "upload_size_mismatch" | "upload_content_mismatch" | "storage_unavailable",
) => ({ ok: false, code }) as const;

const validateImage = (
  head: Uint8Array,
  declaredMime: string,
): { width: number; height: number } | null => {
  const info = inspectImage(head);
  const acceptable =
    info !== null && info.mime === declaredMime && info.width * info.height <= MAX_PIXELS;
  return acceptable ? { width: info.width, height: info.height } : null;
};

const validateOriginal = async (
  storage: ServerStorage,
  version: UploadedVersion,
): Promise<{ width: number | null; height: number | null } | null> => {
  const kind = kindOfMime(version.mimeType);
  const head = await storage.readRange(
    version.storageKey,
    0,
    Math.min(HEAD_BYTES, version.sizeBytes - 1),
  );
  if (head === null) return null;

  if (kind === MediaKind.Image) return validateImage(head, version.mimeType);
  if (kind === MediaKind.Video) return inspectMp4(head) ? { width: null, height: null } : null;

  const tailStart = Math.max(0, version.sizeBytes - TAIL_BYTES);
  const tail = await storage.readRange(version.storageKey, tailStart, version.sizeBytes - 1);
  if (tail === null) return null;
  const whole = new Uint8Array(head.length + tail.length);
  whole.set(head, 0);
  whole.set(tail, head.length);
  return inspectPdf(version.sizeBytes <= HEAD_BYTES ? head : whole)
    ? { width: null, height: null }
    : null;
};

const derivativeBytes = async (
  storage: ServerStorage,
  key: string | null,
): Promise<{ bytes: number } | "invalid" | null> => {
  if (key === null) return null;
  const info = await storage.stat(key);
  if (info === null) return null;
  if (info.size <= 0 || info.size > MAX_DERIVATIVE_BYTES) return "invalid";
  if (!(info.contentType ?? "").toLowerCase().startsWith("image/")) return "invalid";
  const head = await storage.readRange(key, 0, Math.min(HEAD_BYTES, info.size - 1));
  return head !== null && inspectImage(head) !== null ? { bytes: info.size } : "invalid";
};

export const validateUploadedVersion = async (
  storage: ServerStorage,
  version: UploadedVersion,
): Promise<UploadValidation> => {
  const info = await storage.stat(version.storageKey);
  if (info === null) return failure("upload_content_mismatch");
  if (info.size !== version.sizeBytes) return failure("upload_size_mismatch");
  const storedType = (info.contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (storedType !== version.mimeType) return failure("upload_content_mismatch");

  const original = await validateOriginal(storage, version);
  if (original === null) return failure("upload_content_mismatch");

  let total = 0;
  for (const key of [version.thumbKey, version.displayKey]) {
    const result = await derivativeBytes(storage, key);
    if (result === "invalid") return failure("upload_content_mismatch");
    total += result?.bytes ?? 0;
  }

  const checksum = await storage.sha256(version.storageKey);
  if (checksum === null) return failure("storage_unavailable");
  return { ok: true, checksum, ...original, derivativeBytes: total };
};
