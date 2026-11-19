import { sanitizeImportName, sanitizeImportText } from "@/lib/shared/design/import/sanitize";
import type { ValueOf } from "@/lib/shared/utils";

export const FONT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxTables: 64,
  maxNameRecords: 2000,
  textMax: 1000,
  familyMax: 80,
} as const;

export const DesignFontLicenseClass = {
  Installable: "installable",
  Editable: "editable",
  BitmapOnly: "bitmap_only",
  PreviewPrint: "preview_print",
  Restricted: "restricted",
} as const;
export type DesignFontLicenseClass = ValueOf<typeof DesignFontLicenseClass>;

export const FontParseFailure = {
  TooLarge: "too_large",
  Corrupt: "corrupt",
  Collection: "collection",
  Unsupported: "unsupported",
  NoLicenseInfo: "no_license_info",
} as const;
export type FontParseFailure = ValueOf<typeof FontParseFailure>;

export type FontLicenseRecord = {
  family: string;
  style: string;
  copyright: string;
  licenseDescription: string;
  licenseUrl: string;
  fsType: number;
  licenseClass: DesignFontLicenseClass;
  accepted: boolean;
};

export type FontParseResult =
  { ok: true; record: FontLicenseRecord } | { ok: false; failure: FontParseFailure };

const FS_RESTRICTED = 0x0002;
const FS_PREVIEW_PRINT = 0x0004;
const FS_EDITABLE = 0x0008;
const FS_BITMAP_ONLY = 0x0200;
const SFNT_TRUETYPE = 0x00010000;
const SFNT_OTTO = 0x4f54544f;
const SFNT_TRUE = 0x74727565;
const SFNT_TTCF = 0x74746366;
const SFNT_WOFF = 0x774f4646;
const SFNT_WOFF2 = 0x774f4632;
const HEADER_BYTES = 12;
const DIRECTORY_ENTRY_BYTES = 16;
const FS_TYPE_OFFSET = 8;
const NAME_HEADER_BYTES = 6;
const NAME_RECORD_BYTES = 12;
const PLATFORM_UNICODE = 0;
const PLATFORM_MAC = 1;
const PLATFORM_WINDOWS = 3;
const NAME_COPYRIGHT = 0;
const NAME_FAMILY = 1;
const NAME_STYLE = 2;
const NAME_LICENSE = 13;
const NAME_LICENSE_URL = 14;
const NAME_TYPOGRAPHIC_FAMILY = 16;
const NAME_TYPOGRAPHIC_STYLE = 17;
const TAG_OS2 = "OS/2";
const TAG_NAME = "name";

const FS_NO_SUBSETTING = 0x0100;
const FS_KNOWN_BITS =
  FS_RESTRICTED | FS_PREVIEW_PRINT | FS_EDITABLE | FS_NO_SUBSETTING | FS_BITMAP_ONLY;
const USED_NAME_IDS: ReadonlySet<number> = new Set([
  NAME_COPYRIGHT,
  NAME_FAMILY,
  NAME_STYLE,
  NAME_LICENSE,
  NAME_LICENSE_URL,
  NAME_TYPOGRAPHIC_FAMILY,
  NAME_TYPOGRAPHIC_STYLE,
]);
const MAX_DECODED_BYTES = FONT_LIMITS.textMax * 2;

export const classifyFsType = (fsType: number): DesignFontLicenseClass => {
  if ((fsType & ~FS_KNOWN_BITS) !== 0) return DesignFontLicenseClass.Restricted;
  if ((fsType & FS_RESTRICTED) !== 0) return DesignFontLicenseClass.Restricted;
  if ((fsType & FS_PREVIEW_PRINT) !== 0) return DesignFontLicenseClass.PreviewPrint;
  if ((fsType & FS_BITMAP_ONLY) !== 0) return DesignFontLicenseClass.BitmapOnly;
  if ((fsType & FS_EDITABLE) !== 0) return DesignFontLicenseClass.Editable;
  return DesignFontLicenseClass.Installable;
};

export const isAcceptedClass = (licenseClass: DesignFontLicenseClass): boolean =>
  licenseClass === DesignFontLicenseClass.Installable ||
  licenseClass === DesignFontLicenseClass.Editable;

type Table = { offset: number; length: number };

const tagOf = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

const failure = (reason: FontParseFailure): FontParseResult => ({ ok: false, failure: reason });

const refusedMagic = (magic: number): FontParseFailure | null => {
  if (magic === SFNT_TTCF) return FontParseFailure.Collection;
  if (magic === SFNT_WOFF || magic === SFNT_WOFF2) return FontParseFailure.Unsupported;
  const known = magic === SFNT_TRUETYPE || magic === SFNT_OTTO || magic === SFNT_TRUE;
  return known ? null : FontParseFailure.Corrupt;
};

const noOverlap = (tables: Table[]): boolean => {
  const sorted = tables.filter((table) => table.length > 0).sort((a, b) => a.offset - b.offset);
  return sorted.every((table, index) => {
    const previous = sorted[index - 1];
    return previous === undefined || previous.offset + previous.length <= table.offset;
  });
};

const readDirectory = (view: DataView): Map<string, Table> | null => {
  const count = view.getUint16(4);
  const directoryEnd = HEADER_BYTES + count * DIRECTORY_ENTRY_BYTES;
  if (count === 0 || count > FONT_LIMITS.maxTables || directoryEnd > view.byteLength) return null;
  const tables = new Map<string, Table>();
  for (let index = 0; index < count; index += 1) {
    const entry = HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES;
    const table = { offset: view.getUint32(entry + 8), length: view.getUint32(entry + 12) };
    if (table.offset < directoryEnd || table.offset + table.length > view.byteLength) return null;
    const tag = tagOf(view, entry);
    if (tables.has(tag)) return null;
    tables.set(tag, table);
  }
  return noOverlap([...tables.values()]) ? tables : null;
};

const decodeUtf16Be = (view: DataView, offset: number, length: number): string => {
  let text = "";
  for (let at = offset; at + 1 < offset + length; at += 2) {
    text += String.fromCharCode(view.getUint16(at));
  }
  return text;
};

const decodeLatin1 = (view: DataView, offset: number, length: number): string => {
  let text = "";
  for (let at = offset; at < offset + length; at += 1)
    text += String.fromCharCode(view.getUint8(at));
  return text;
};

const decodeNameString = (
  view: DataView,
  platform: number,
  offset: number,
  length: number,
): string | null => {
  if (platform === PLATFORM_WINDOWS || platform === PLATFORM_UNICODE) {
    return decodeUtf16Be(view, offset, length);
  }
  return platform === PLATFORM_MAC ? decodeLatin1(view, offset, length) : null;
};

const readNames = (view: DataView, table: Table): Map<number, string> | null => {
  if (table.length < NAME_HEADER_BYTES) return null;
  const count = view.getUint16(table.offset + 2);
  const storage = table.offset + view.getUint16(table.offset + 4);
  const recordsEnd = table.offset + NAME_HEADER_BYTES + count * NAME_RECORD_BYTES;
  if (count > FONT_LIMITS.maxNameRecords || recordsEnd > table.offset + table.length) return null;
  const names = new Map<number, string>();
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + NAME_HEADER_BYTES + index * NAME_RECORD_BYTES;
    const length = view.getUint16(record + 8);
    const start = storage + view.getUint16(record + 10);
    if (start + length > table.offset + table.length) return null;
    const id = view.getUint16(record + 6);
    if (!USED_NAME_IDS.has(id) || names.has(id)) continue;
    const text = decodeNameString(
      view,
      view.getUint16(record),
      start,
      Math.min(length, MAX_DECODED_BYTES),
    );
    if (text !== null && text !== "") names.set(id, text);
  }
  return names;
};

const pick = (names: Map<number, string>, ...ids: number[]): string => {
  for (const id of ids) {
    const value = names.get(id);
    if (value !== undefined) return value;
  }
  return "";
};

const recordOf = (names: Map<number, string>, fsType: number): FontLicenseRecord => {
  const licenseClass = classifyFsType(fsType);
  return {
    family: sanitizeImportName(
      pick(names, NAME_TYPOGRAPHIC_FAMILY, NAME_FAMILY),
      FONT_LIMITS.familyMax,
    ),
    style: sanitizeImportName(
      pick(names, NAME_TYPOGRAPHIC_STYLE, NAME_STYLE),
      FONT_LIMITS.familyMax,
    ),
    copyright: sanitizeImportText(pick(names, NAME_COPYRIGHT), FONT_LIMITS.textMax),
    licenseDescription: sanitizeImportText(pick(names, NAME_LICENSE), FONT_LIMITS.textMax),
    licenseUrl: sanitizeImportText(pick(names, NAME_LICENSE_URL), FONT_LIMITS.textMax),
    fsType,
    licenseClass,
    accepted: isAcceptedClass(licenseClass),
  };
};

export const parseFontLicense = (bytes: Uint8Array): FontParseResult => {
  if (bytes.length > FONT_LIMITS.maxBytes) return failure(FontParseFailure.TooLarge);
  if (bytes.length < HEADER_BYTES) return failure(FontParseFailure.Corrupt);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const refused = refusedMagic(view.getUint32(0));
  if (refused !== null) return failure(refused);
  const tables = readDirectory(view);
  if (tables === null) return failure(FontParseFailure.Corrupt);
  const os2 = tables.get(TAG_OS2);
  if (os2 === undefined) return failure(FontParseFailure.NoLicenseInfo);
  if (os2.length < FS_TYPE_OFFSET + 2) return failure(FontParseFailure.Corrupt);
  const fsType = view.getUint16(os2.offset + FS_TYPE_OFFSET);
  const nameTable = tables.get(TAG_NAME);
  const names = nameTable === undefined ? new Map<number, string>() : readNames(view, nameTable);
  if (names === null) return failure(FontParseFailure.Corrupt);
  return { ok: true, record: recordOf(names, fsType) };
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
