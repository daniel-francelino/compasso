import {
  DESIGN_IMPORT_MESSAGE,
  DESIGN_IMPORT_FORMAT_LABEL,
} from "@/lib/shared/design/import/messages";
import { IMPORT_HANDLERS } from "@/lib/shared/design/import/registry";
import { SNIFF_HEAD_BYTES, extensionOf } from "@/lib/shared/design/import/sniff";
import type {
  ImportContext,
  ImportHandler,
  ImportKindResult,
  WorkerImportInput,
} from "@/lib/shared/design/import/types";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

const errorName = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

const LIST_SEPARATOR = ", ";
const LAST_SEPARATOR = " ou ";

const readBytes = async (blob: Blob): Promise<Uint8Array | null> => {
  try {
    return new Uint8Array(await blob.arrayBuffer());
  } catch (error) {
    logError("import file read failed", errorName(error));
    return null;
  }
};

const formatList = (handlers: readonly ImportHandler[]): string => {
  const labels = handlers.map((handler) => DESIGN_IMPORT_FORMAT_LABEL[handler.format]);
  const last = labels.pop();
  return labels.length === 0 ? (last ?? "") : labels.join(LIST_SEPARATOR) + LAST_SEPARATOR + last;
};

const largestLimit = (): number =>
  IMPORT_HANDLERS.reduce((largest, handler) => Math.max(largest, handler.maxBytes), 0);

const pickHandler = (head: Uint8Array, name: string): Result<{ handler: ImportHandler }> => {
  const matches = IMPORT_HANDLERS.filter((handler) => handler.sniff(head));
  if (matches.length === 0) {
    return invalid(DESIGN_IMPORT_MESSAGE.unsupportedType(formatList(IMPORT_HANDLERS)));
  }
  const extension = extensionOf(name);
  const handler = matches.find((candidate) => candidate.extensions.includes(extension));
  return handler === undefined
    ? invalid(DESIGN_IMPORT_MESSAGE.nameMismatch)
    : { ok: true, handler };
};

const runHandler = async (
  handler: ImportHandler,
  input: WorkerImportInput,
): Promise<Result<ImportKindResult>> => {
  if (handler.runsIn === "worker") return handler.decode(input);
  const bytes = await readBytes(input.file);
  if (bytes === null) return invalid(DESIGN_IMPORT_MESSAGE.readFailed);
  return handler.decode({ ...input, bytes });
};

const decodeWith = async (
  handler: ImportHandler,
  input: WorkerImportInput,
): Promise<Result<ImportKindResult>> => {
  try {
    return await runHandler(handler, input);
  } catch (error) {
    logError("import decode failed", errorName(error));
    return invalid(DESIGN_IMPORT_MESSAGE.readFailed);
  }
};

const DEFAULT_CONTEXT: ImportContext = {
  capacityElements: DESIGN_LIMITS.maxElements,
  usedBytes: 0,
};

export const readDesignFile = async (
  file: File,
  newId: () => string,
  context: ImportContext = DEFAULT_CONTEXT,
): Promise<Result<ImportKindResult>> => {
  if (file.size === 0) return invalid(DESIGN_IMPORT_MESSAGE.empty);
  if (file.size > largestLimit()) return invalid(DESIGN_IMPORT_MESSAGE.tooLarge(largestLimit()));
  const head = await readBytes(file.slice(0, SNIFF_HEAD_BYTES));
  if (head === null) return invalid(DESIGN_IMPORT_MESSAGE.readFailed);
  const picked = pickHandler(head, file.name);
  if (!picked.ok) return picked;
  const { handler } = picked;
  if (file.size > handler.maxBytes)
    return invalid(DESIGN_IMPORT_MESSAGE.tooLarge(handler.maxBytes));
  return decodeWith(handler, { ...context, file, newId });
};
