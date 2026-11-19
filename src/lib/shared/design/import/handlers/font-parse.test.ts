import { describe, expect, it } from "vitest";
import {
  DesignFontLicenseClass,
  FONT_LIMITS,
  FontParseFailure,
  classifyFsType,
  parseFontLicense,
  sha256Hex,
} from "@/lib/shared/design/import/handlers/font-parse";

type TableSpec = { tag: string; data: Uint8Array };

const u16 = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];
const u32 = (value: number): number[] => [...u16(value >>> 16), ...u16(value & 0xffff)];
const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));

const os2Table = (fsType: number): Uint8Array =>
  new Uint8Array([
    ...u16(4),
    ...u16(500),
    ...u16(400),
    ...u16(5),
    ...u16(fsType),
    ...new Array(20).fill(0),
  ]);

const nameTable = (entries: [number, string][]): Uint8Array => {
  const strings = entries.map(([, text]) => text.split("").flatMap((c) => u16(c.charCodeAt(0))));
  let offset = 0;
  const records = entries.flatMap(([id], index) => {
    const length = strings[index]?.length ?? 0;
    const record = [
      ...u16(3),
      ...u16(1),
      ...u16(0x409),
      ...u16(id),
      ...u16(length),
      ...u16(offset),
    ];
    offset += length;
    return record;
  });
  const header = [...u16(0), ...u16(entries.length), ...u16(6 + entries.length * 12)];
  return new Uint8Array([...header, ...records, ...strings.flat()]);
};

const sfnt = (tables: TableSpec[], magic = 0x00010000): Uint8Array => {
  const directoryEnd = 12 + tables.length * 16;
  let offset = directoryEnd;
  const entries: number[] = [];
  const bodies: number[] = [];
  for (const table of tables) {
    entries.push(...ascii(table.tag), ...u32(0), ...u32(offset), ...u32(table.data.length));
    bodies.push(...table.data);
    offset += table.data.length;
  }
  return new Uint8Array([
    ...u32(magic),
    ...u16(tables.length),
    0,
    0,
    0,
    0,
    0,
    0,
    ...entries,
    ...bodies,
  ]);
};

const font = (fsType: number): Uint8Array =>
  sfnt([
    { tag: "OS/2", data: os2Table(fsType) },
    {
      tag: "name",
      data: nameTable([
        [0, "Copyright Acme"],
        [1, "Acme Sans"],
        [2, "Bold"],
        [13, "Free to use"],
        [14, "https://example.test/license"],
      ]),
    },
  ]);

const classOf = (fsType: number): string | null => {
  const result = parseFontLicense(font(fsType));
  return result.ok ? result.record.licenseClass : null;
};

describe("parseFontLicense fsType rule (A4)", () => {
  it("accepts 0x0000, 0x0008 and allows 0x0100", () => {
    for (const fsType of [0x0000, 0x0008, 0x0100, 0x0108]) {
      const result = parseFontLicense(font(fsType));
      expect(result.ok && result.record.accepted, String(fsType)).toBe(true);
    }
  });

  it("refuses 0x0002, 0x0004 and 0x0200 with the class", () => {
    expect(classOf(0x0002)).toBe(DesignFontLicenseClass.Restricted);
    expect(classOf(0x0004)).toBe(DesignFontLicenseClass.PreviewPrint);
    expect(classOf(0x0200)).toBe(DesignFontLicenseClass.BitmapOnly);
    for (const fsType of [0x0002, 0x0004, 0x0200]) {
      const result = parseFontLicense(font(fsType));
      expect(result.ok && result.record.accepted).toBe(false);
    }
  });

  it("uses the most restrictive bit of combinations", () => {
    expect(classifyFsType(0x0006)).toBe(DesignFontLicenseClass.Restricted);
    expect(classifyFsType(0x000e)).toBe(DesignFontLicenseClass.Restricted);
    expect(classifyFsType(0x0102)).toBe(DesignFontLicenseClass.Restricted);
    expect(classifyFsType(0x020c)).toBe(DesignFontLicenseClass.PreviewPrint);
  });

  it("reads the strings as capped plain text", () => {
    const result = parseFontLicense(font(0));
    expect(result.ok && result.record).toMatchObject({
      family: "Acme Sans",
      style: "Bold",
      copyright: "Copyright Acme",
      licenseDescription: "Free to use",
      licenseUrl: "https://example.test/license",
      fsType: 0,
    });
  });

  it("refuses a font without OS/2 because the licence cannot be verified", () => {
    const bytes = sfnt([{ tag: "name", data: nameTable([[1, "A"]]) }]);
    expect(parseFontLicense(bytes)).toEqual({ ok: false, failure: FontParseFailure.NoLicenseInfo });
  });
});

describe("parseFontLicense hostile input", () => {
  const failureOf = (bytes: Uint8Array): string | null => {
    const result = parseFontLicense(bytes);
    return result.ok ? null : result.failure;
  };

  it("refuses collections, WOFF, WOFF2 and unknown magic", () => {
    expect(failureOf(sfnt([], 0x74746366))).toBe(FontParseFailure.Collection);
    expect(failureOf(sfnt([], 0x774f4646))).toBe(FontParseFailure.Unsupported);
    expect(failureOf(sfnt([], 0x774f4632))).toBe(FontParseFailure.Unsupported);
    expect(failureOf(sfnt([], 0x12345678))).toBe(FontParseFailure.Corrupt);
  });

  it("refuses an oversized font and a tiny file", () => {
    expect(failureOf(new Uint8Array(FONT_LIMITS.maxBytes + 1))).toBe(FontParseFailure.TooLarge);
    expect(failureOf(new Uint8Array(5))).toBe(FontParseFailure.Corrupt);
  });

  it("refuses a table count above the cap and a directory past the end", () => {
    const many = font(0);
    many.set(u16(65535), 4);
    expect(failureOf(many)).toBe(FontParseFailure.Corrupt);
    const zero = font(0);
    zero.set(u16(0), 4);
    expect(failureOf(zero)).toBe(FontParseFailure.Corrupt);
  });

  it("never throws when truncated at every length", () => {
    const whole = font(0);
    for (let length = 0; length < whole.length; length += 1) {
      expect(() => parseFontLicense(whole.slice(0, length))).not.toThrow();
      expect(failureOf(whole.slice(0, length)), String(length)).not.toBe(null);
    }
  });

  it("refuses a table offset or length past the file and an overflowing sum", () => {
    const beyond = font(0);
    new DataView(beyond.buffer).setUint32(12 + 8, 0xfffffff0);
    expect(failureOf(beyond)).toBe(FontParseFailure.Corrupt);
    const wrap = font(0);
    new DataView(wrap.buffer).setUint32(12 + 12, 0xffffffff);
    expect(failureOf(wrap)).toBe(FontParseFailure.Corrupt);
  });

  it("refuses overlapping tables", () => {
    const bytes = font(0);
    const view = new DataView(bytes.buffer);
    view.setUint32(12 + 16 + 8, view.getUint32(12 + 8));
    expect(failureOf(bytes)).toBe(FontParseFailure.Corrupt);
  });

  it("strips control characters and caps long names", () => {
    const long = "A".repeat(2000);
    const bytes = sfnt([
      { tag: "OS/2", data: os2Table(0) },
      {
        tag: "name",
        data: nameTable([
          [1, "Bad" + String.fromCharCode(0) + String.fromCharCode(7) + "Name"],
          [13, long],
        ]),
      },
    ]);
    const result = parseFontLicense(bytes);
    expect(result.ok && result.record.family).toBe("BadName");
    expect(result.ok && result.record.licenseDescription.length).toBe(FONT_LIMITS.textMax);
  });

  it("refuses a name table whose string runs past the table", () => {
    const table = nameTable([[1, "Acme"]]);
    new DataView(table.buffer).setUint16(6 + 8, 4000);
    const bytes = sfnt([
      { tag: "OS/2", data: os2Table(0) },
      { tag: "name", data: table },
    ]);
    expect(failureOf(bytes)).toBe(FontParseFailure.Corrupt);
  });
});

describe("sha256Hex", () => {
  it("hashes bytes", async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
