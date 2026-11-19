import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { sketchFailure } from "@/lib/shared/design/import/refusal";
import { SketchRefusal } from "@/lib/shared/design/import/types";
import { errorName } from "@/lib/shared/design/import/run-limits";
import { logError } from "@/lib/shared/logger";
import type { Failure, Result } from "@/lib/shared/server-utils";

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_BYTES = 22;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_BYTES = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_BYTES = 30;
const ZIP64_MARK = 0xffffffff;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const SLASH = "/";
const SLICE_BYTES = 16 * 1024;
const BACKSLASH = String.fromCharCode(92);
const FIRST_PRINTABLE = 32;
const DELETE_CHARACTER = 127;
const DRIVE_LETTER = /^[A-Za-z]:/;
const CURRENT = ".";
const PARENT = "..";

export type ZipEntry = {
  name: string;
  method: typeof METHOD_STORED | typeof METHOD_DEFLATE;
  compressedSize: number;
  size: number;
  dataStart: number;
};

export type ZipIndex = {
  bytes: Uint8Array;
  entries: ReadonlyMap<string, ZipEntry>;
  remaining: { bytes: number };
};

type RawEntry = ZipEntry & { localOffset: number; nameBytes: Uint8Array; directory: boolean };

const fail = (refusal: SketchRefusal): Failure => sketchFailure(refusal);

export const isSafeZipName = (name: string): boolean => {
  if (name.length === 0 || name.length > SKETCH_LIMITS.maxNameLength) return false;
  if (name.startsWith(SLASH) || name.includes(BACKSLASH) || DRIVE_LETTER.test(name)) return false;
  for (let index = 0; index < name.length; index += 1) {
    const code = name.charCodeAt(index);
    if (code < FIRST_PRINTABLE || code === DELETE_CHARACTER) return false;
  }
  const trimmed = name.endsWith(SLASH) ? name.slice(0, -1) : name;
  return trimmed.split(SLASH).every((part) => part !== "" && part !== CURRENT && part !== PARENT);
};

const foldedName = (name: string): string => name.normalize("NFC").toLowerCase();

const findEndRecord = (
  view: DataView,
): { offset: number; entries: number; size: number; start: number } | null => {
  const length = view.byteLength;
  const lowest = Math.max(0, length - EOCD_BYTES - SKETCH_LIMITS.eocdWindowBytes);
  for (let offset = length - EOCD_BYTES; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;
    if (offset + EOCD_BYTES + view.getUint16(offset + 20, true) !== length) continue;
    return {
      offset,
      entries: view.getUint16(offset + 10, true),
      size: view.getUint32(offset + 12, true),
      start: view.getUint32(offset + 16, true),
    };
  }
  return null;
};

type EndCheck = { entries: number; size: number; start: number } | Failure;

const checkEndRecord = (view: DataView): EndCheck => {
  if (view.byteLength < EOCD_BYTES) return fail(SketchRefusal.NotZip);
  const end = findEndRecord(view);
  if (end === null) return fail(SketchRefusal.NotZip);
  const disks = [view.getUint16(end.offset + 4, true), view.getUint16(end.offset + 6, true)];
  const onDisk = view.getUint16(end.offset + 8, true);
  if (disks.some((disk) => disk !== 0) || onDisk !== end.entries) {
    return fail(SketchRefusal.Corrupt);
  }
  if (end.entries > SKETCH_LIMITS.maxEntries) return fail(SketchRefusal.ZipEntries);
  if (end.size === ZIP64_MARK || end.start === ZIP64_MARK) {
    return fail(SketchRefusal.ZipTooLarge);
  }
  if (end.entries === 0 || end.start + end.size !== end.offset) {
    return fail(SketchRefusal.Corrupt);
  }
  return { entries: end.entries, size: end.size, start: end.start };
};

const decodeName = (nameBytes: Uint8Array): string | null => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
  } catch {
    return null;
  }
};

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const readCentralEntry = (
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  limit: number,
): { entry: RawEntry; next: number } | Failure => {
  if (offset + CENTRAL_BYTES > limit || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
    return fail(SketchRefusal.Corrupt);
  }
  const flags = view.getUint16(offset + 8, true);
  if ((flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION)) !== 0) {
    return fail(SketchRefusal.Encrypted);
  }
  const method = view.getUint16(offset + 10, true);
  const compressedSize = view.getUint32(offset + 20, true);
  const size = view.getUint32(offset + 24, true);
  const localOffset = view.getUint32(offset + 42, true);
  if ([compressedSize, size, localOffset].includes(ZIP64_MARK)) {
    return fail(SketchRefusal.ZipTooLarge);
  }
  const nameLength = view.getUint16(offset + 28, true);
  const next =
    offset +
    CENTRAL_BYTES +
    nameLength +
    view.getUint16(offset + 30, true) +
    view.getUint16(offset + 32, true);
  if (next > limit) return fail(SketchRefusal.Corrupt);
  if (view.getUint16(offset + 34, true) !== 0) return fail(SketchRefusal.Corrupt);
  if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
    return fail(SketchRefusal.Corrupt);
  }
  const nameBytes = bytes.subarray(offset + CENTRAL_BYTES, offset + CENTRAL_BYTES + nameLength);
  const name = decodeName(nameBytes);
  if (name === null || !isSafeZipName(name)) return fail(SketchRefusal.ZipPath);
  return {
    entry: {
      name,
      method,
      compressedSize,
      size,
      dataStart: 0,
      localOffset,
      nameBytes,
      directory: name.endsWith(SLASH),
    },
    next,
  };
};

const locateData = (
  bytes: Uint8Array,
  view: DataView,
  entry: RawEntry,
  centralStart: number,
): number | Failure => {
  const { localOffset } = entry;
  if (localOffset + LOCAL_BYTES > centralStart) return fail(SketchRefusal.Corrupt);
  if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
    return fail(SketchRefusal.Corrupt);
  }
  const flags = view.getUint16(localOffset + 6, true);
  if ((flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION)) !== 0) {
    return fail(SketchRefusal.Encrypted);
  }
  const nameLength = view.getUint16(localOffset + 26, true);
  const dataStart = localOffset + LOCAL_BYTES + nameLength + view.getUint16(localOffset + 28, true);
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > centralStart) return fail(SketchRefusal.Corrupt);
  const localName = bytes.subarray(
    localOffset + LOCAL_BYTES,
    localOffset + LOCAL_BYTES + nameLength,
  );
  if (!sameBytes(localName, entry.nameBytes)) return fail(SketchRefusal.Corrupt);
  return dataStart;
};

const noOverlap = (entries: readonly RawEntry[]): boolean => {
  const ranges = entries
    .filter((entry) => !entry.directory)
    .map((entry) => ({ start: entry.localOffset, end: entry.dataStart + entry.compressedSize }))
    .sort((left, right) => left.start - right.start);
  return ranges.every(
    (range, index) => index === 0 || range.start >= (ranges[index - 1]?.end ?? 0),
  );
};

export const openZip = (bytes: Uint8Array): Result<{ zip: ZipIndex }> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = checkEndRecord(view);
  if ("ok" in end) return end;
  const limit = end.start + end.size;
  const raws: RawEntry[] = [];
  let offset = end.start;
  for (let index = 0; index < end.entries; index += 1) {
    const read = readCentralEntry(bytes, view, offset, limit);
    if ("ok" in read) return read;
    raws.push(read.entry);
    offset = read.next;
  }
  if (offset !== limit) return fail(SketchRefusal.Corrupt);
  const seen = new Set<string>();
  let declaredTotal = 0;
  for (const raw of raws) {
    const folded = foldedName(raw.name.endsWith(SLASH) ? raw.name.slice(0, -1) : raw.name);
    if (seen.has(folded)) return fail(SketchRefusal.ZipPath);
    seen.add(folded);
    declaredTotal += raw.size;
  }
  if (declaredTotal > SKETCH_LIMITS.maxTotalBytes) return fail(SketchRefusal.ZipTooLarge);
  const entries = new Map<string, ZipEntry>();
  if (raws.some((raw) => raw.directory && (raw.size !== 0 || raw.compressedSize > 2))) {
    return fail(SketchRefusal.Corrupt);
  }
  for (const raw of raws.filter((candidate) => !candidate.directory)) {
    const dataStart = locateData(bytes, view, raw, end.start);
    if (typeof dataStart !== "number") return dataStart;
    raw.dataStart = dataStart;
    entries.set(raw.name, {
      name: raw.name,
      method: raw.method,
      compressedSize: raw.compressedSize,
      size: raw.size,
      dataStart,
    });
  }
  if (!noOverlap(raws)) return fail(SketchRefusal.Corrupt);
  return { ok: true, zip: { bytes, entries, remaining: { bytes: SKETCH_LIMITS.maxTotalBytes } } };
};

const overRatio = (produced: number, compressedSize: number): boolean =>
  produced > SKETCH_LIMITS.ratioFloorBytes && produced > compressedSize * SKETCH_LIMITS.ratioLimit;

const concat = (chunks: readonly Uint8Array[], length: number): Uint8Array => {
  const joined = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    joined.set(chunk, position);
    position += chunk.length;
  }
  return joined;
};

export type ReadProbe = { produced: number; fed: number };

const inflateBounded = async (
  entry: ZipEntry,
  compressed: Uint8Array,
  limit: number,
  signal: AbortSignal | undefined,
  probe: ReadProbe,
): Promise<Result<{ data: Uint8Array }>> => {
  if (typeof DecompressionStream === "undefined") {
    return fail(SketchRefusal.ReadFailed);
  }
  const source = new ReadableStream<BufferSource>({
    pull(controller) {
      if (probe.fed >= compressed.length) {
        controller.close();
        return;
      }
      const end = Math.min(probe.fed + SLICE_BYTES, compressed.length);
      controller.enqueue(compressed.slice(probe.fed, end));
      probe.fed = end;
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  const stop = async (failure: Failure): Promise<Failure> => {
    await reader.cancel().catch(() => undefined);
    return failure;
  };
  try {
    for (;;) {
      if (signal?.aborted === true) return await stop(IMPORT_CANCELLED);
      const next = await reader.read();
      if (next.done) break;
      probe.produced += next.value.length;
      if (overRatio(probe.produced, probe.fed)) {
        return await stop(fail(SketchRefusal.ZipRatio));
      }
      if (probe.produced > limit) return await stop(fail(SketchRefusal.ZipTooLarge));
      if (probe.produced > entry.size) return await stop(fail(SketchRefusal.Corrupt));
      chunks.push(next.value);
    }
  } catch (error) {
    logError("sketch inflate failed", errorName(error));
    return fail(SketchRefusal.Corrupt);
  }
  if (probe.produced !== entry.size) return fail(SketchRefusal.Corrupt);
  return { ok: true, data: concat(chunks, probe.produced) };
};

const readStored = (entry: ZipEntry, compressed: Uint8Array): Result<{ data: Uint8Array }> =>
  entry.size === entry.compressedSize
    ? { ok: true, data: compressed.slice() }
    : fail(SketchRefusal.Corrupt);

const charge = (
  zip: ZipIndex,
  outcome: Result<{ data: Uint8Array }>,
): Result<{ data: Uint8Array }> => {
  if (outcome.ok) zip.remaining.bytes -= outcome.data.length;
  return outcome;
};

export const readZipEntry = async (
  zip: ZipIndex,
  name: string,
  maxBytes: number,
  signal?: AbortSignal,
  probe: ReadProbe = { produced: 0, fed: 0 },
): Promise<Result<{ data: Uint8Array }>> => {
  const entry = zip.entries.get(name);
  if (entry === undefined) return fail(SketchRefusal.Corrupt);
  const limit = Math.min(maxBytes, zip.remaining.bytes);
  if (entry.size > limit) return fail(SketchRefusal.ZipTooLarge);
  if (overRatio(entry.size, entry.compressedSize)) {
    return fail(SketchRefusal.ZipRatio);
  }
  const compressed = zip.bytes.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
  const outcome =
    entry.method === METHOD_STORED
      ? readStored(entry, compressed)
      : await inflateBounded(entry, compressed, limit, signal, probe);
  return charge(zip, outcome);
};
