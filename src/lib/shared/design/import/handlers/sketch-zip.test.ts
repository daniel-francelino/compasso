import { describe, expect, it } from "vitest";
import {
  buildZip,
  deflateRaw,
  text,
  type FixtureEntry,
} from "@/lib/shared/design/import/handlers/sketch-zip-fixtures";
import {
  isSafeZipName,
  openZip,
  readZipEntry,
} from "@/lib/shared/design/import/handlers/sketch-zip";
import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";

const MIB = 1024 * 1024;
const NUL = String.fromCharCode(0);
const E_ACUTE = String.fromCharCode(0xe9);
const COMBINING_ACUTE = String.fromCharCode(0x301);
const BACKSLASH = String.fromCharCode(92);

const messageOf = (result: { ok: boolean; message?: string }): string | null =>
  result.ok ? null : (result.message ?? null);

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  let state = 0x2545f491;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
};

const stored = (name: string, body = "x"): FixtureEntry => ({ name, data: text(body) });
const deflated = (name: string, body: string): FixtureEntry => ({
  name,
  data: text(body),
  method: 8,
});

const open = async (entries: FixtureEntry[], options?: Parameters<typeof buildZip>[1]) =>
  openZip(await buildZip(entries, options));

describe("openZip structure", () => {
  it("indexes stored and deflated entries and reads them back", async () => {
    const opened = await open([stored("meta.json", "{}"), deflated("document.json", "[1,2,3]")]);
    if (!opened.ok) throw new Error("expected an index");
    expect([...opened.zip.entries.keys()]).toEqual(["meta.json", "document.json"]);
    const meta = await readZipEntry(opened.zip, "meta.json", MIB);
    const document = await readZipEntry(opened.zip, "document.json", MIB);
    expect(meta.ok && new TextDecoder().decode(meta.data)).toBe("{}");
    expect(document.ok && new TextDecoder().decode(document.data)).toBe("[1,2,3]");
  });

  it("refuses bytes that are not a zip", () => {
    expect(messageOf(openZip(text("not a zip at all, just some text")))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchNotZip,
    );
    expect(messageOf(openZip(new Uint8Array(5)))).toBe(DESIGN_IMPORT_MESSAGE.sketchNotZip);
  });

  it("refuses 2001 entries before reading anything", async () => {
    const entries = Array.from({ length: SKETCH_LIMITS.maxEntries + 1 }, (_, index) =>
      stored(`pages/${index}.json`),
    );
    expect(messageOf(await open(entries))).toBe(DESIGN_IMPORT_MESSAGE.zipTooManyEntries);
  });

  it("accepts exactly 2000 entries", async () => {
    const entries = Array.from({ length: SKETCH_LIMITS.maxEntries }, (_, index) =>
      stored(`pages/${index}.json`),
    );
    expect((await open(entries)).ok).toBe(true);
  });

  it("refuses an end record that claims 65535 entries", async () => {
    expect(messageOf(await open([stored("a.json")], { entryCount: 0xffff }))).toBe(
      DESIGN_IMPORT_MESSAGE.zipTooManyEntries,
    );
  });

  it("refuses an end record that undercounts the central directory", async () => {
    const result = await open([stored("a.json"), stored("b.json")], { entryCount: 1 });
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses a multi-disk archive, trailing bytes and a missing end record", async () => {
    expect(messageOf(await open([stored("a.json")], { diskNumber: 1 }))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchCorrupt,
    );
    expect(messageOf(await open([stored("a.json")], { trailing: text("junk") }))).not.toBe(null);
    expect(messageOf(await open([stored("a.json")], { skipEnd: true }))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchNotZip,
    );
  });

  it("ignores a fake end signature in the comment but refuses an ambiguous one at the very end", async () => {
    const fake = new Uint8Array(22);
    new DataView(fake.buffer).setUint32(0, 0x06054b50, true);
    new DataView(fake.buffer).setUint16(20, 5, true);
    expect((await open([stored("a.json")], { comment: fake })).ok).toBe(true);
    const ambiguous = new Uint8Array(22);
    new DataView(ambiguous.buffer).setUint32(0, 0x06054b50, true);
    expect((await open([stored("a.json")], { comment: ambiguous })).ok).toBe(false);
  });

  it("refuses the encrypted flags", async () => {
    expect(messageOf(await open([{ ...stored("a.json"), flags: 1 }]))).toBe(
      DESIGN_IMPORT_MESSAGE.encrypted,
    );
    expect(messageOf(await open([{ ...stored("a.json"), flags: 0x40 }]))).toBe(
      DESIGN_IMPORT_MESSAGE.encrypted,
    );
  });

  it("refuses zip64 markers and unsupported methods", async () => {
    const huge = { ...stored("a.json"), declaredSize: 0xffffffff };
    expect(messageOf(await open([huge]))).toBe(DESIGN_IMPORT_MESSAGE.zipTooLarge);
    const unknown = { ...stored("a.json"), method: 12 };
    expect(messageOf(await open([unknown]))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses overlapping entries and a local header that disagrees on the name", async () => {
    const overlap = await open([
      stored("a.json", "aaaaaaaaaa"),
      { ...stored("b.json", "bbbbbbbbbb"), localOffsetOverride: 0 },
    ]);
    expect(messageOf(overlap)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    const renamed = await open([{ ...stored("document.json"), localName: "evil.json" }]);
    expect(messageOf(renamed)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses an offset that points outside the file", async () => {
    const lost = await open([{ ...stored("a.json"), localOffsetOverride: 100000 }]);
    expect(messageOf(lost)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    const shifted = await open([stored("a.json")], { centralStartShift: 5 });
    expect(messageOf(shifted)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses declared sizes that add up past the total cap before inflating", async () => {
    const bomb = { ...stored("pages/a.json"), declaredSize: 200 * MIB };
    const other = { ...stored("pages/b.json"), declaredSize: 100 * MIB };
    expect(messageOf(await open([bomb, other]))).toBe(DESIGN_IMPORT_MESSAGE.zipTooLarge);
  });
});

describe("entry names", () => {
  const hostile = [
    "../x",
    "a/../b",
    "/x",
    "C:/x",
    "c:x",
    `a${BACKSLASH}..${BACKSLASH}b`,
    `a${BACKSLASH}b`,
    "a/./b",
    "a//b",
    "x".repeat(256),
    `a${NUL}b`,
    "tab\tname",
    "",
  ];

  it.each(hostile)("rejects the name %j", (name) => {
    expect(isSafeZipName(name)).toBe(false);
  });

  it.each(["document.json", "pages/abc.json", "images/0123.png", "dir/", "x".repeat(255)])(
    "accepts the name %j",
    (name) => {
      expect(isSafeZipName(name)).toBe(true);
    },
  );

  it("refuses the whole archive when one entry name is unsafe, even a skipped one", async () => {
    const names = [
      "../x",
      "/x",
      `C:${BACKSLASH}x`,
      `a${BACKSLASH}..${BACKSLASH}b`,
      `nul${NUL}.json`,
    ];
    for (const name of names) {
      const result = await open([stored("document.json"), stored(name)]);
      expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.zipUnsafePath);
    }
  });

  it("refuses duplicate names and case or normalization variants", async () => {
    expect(messageOf(await open([stored("a.json"), stored("a.json")]))).toBe(
      DESIGN_IMPORT_MESSAGE.zipUnsafePath,
    );
    expect(messageOf(await open([stored("Doc.json"), stored("doc.JSON")]))).toBe(
      DESIGN_IMPORT_MESSAGE.zipUnsafePath,
    );
    const composed = `caf${E_ACUTE}.json`;
    const decomposed = `cafe${COMBINING_ACUTE}.json`;
    expect(messageOf(await open([stored(composed), stored(decomposed)]))).toBe(
      DESIGN_IMPORT_MESSAGE.zipUnsafePath,
    );
  });
});

describe("readZipEntry bounds", () => {
  it("stops inflation by the in-stream cap when the declared size equals the cap", async () => {
    const CAP = 64 * 1024;
    const rawCompressed = await deflateRaw(randomBytes(3 * MIB));
    const opened = await open([
      {
        name: "pages/a.json",
        data: new Uint8Array(1),
        method: 8,
        rawCompressed,
        declaredSize: CAP,
        declaredCompressed: rawCompressed.length,
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    const probe = { produced: 0, fed: 0 };
    const result = await readZipEntry(opened.zip, "pages/a.json", CAP, undefined, probe);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.zipTooLarge);
    expect(probe.produced).toBeGreaterThan(CAP);
    expect(probe.produced).toBeLessThan(MIB);
    expect(opened.zip.remaining.bytes).toBe(SKETCH_LIMITS.maxTotalBytes);
  }, 60_000);

  it("stops a 1000 to 1 stream by the in-stream ratio, below the cap", async () => {
    const SIZE = 30 * MIB;
    const rawCompressed = await deflateRaw(new Uint8Array(SIZE));
    const opened = await open([
      {
        name: "pages/a.json",
        data: new Uint8Array(1),
        method: 8,
        rawCompressed,
        declaredSize: rawCompressed.length * SKETCH_LIMITS.ratioLimit,
        declaredCompressed: rawCompressed.length,
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    const probe = { produced: 0, fed: 0 };
    const result = await readZipEntry(
      opened.zip,
      "pages/a.json",
      SKETCH_LIMITS.maxPageJsonBytes,
      undefined,
      probe,
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.zipRatioExceeded);
    expect(probe.produced).toBeLessThan(SIZE);
    expect(opened.zip.remaining.bytes).toBe(SKETCH_LIMITS.maxTotalBytes);
  }, 60_000);

  it("refuses by the declared ratio before inflating anything", async () => {
    const rawCompressed = await deflateRaw(new Uint8Array(30 * MIB));
    const opened = await open([
      {
        name: "pages/a.json",
        data: new Uint8Array(1),
        method: 8,
        rawCompressed,
        declaredSize: 30 * MIB,
        declaredCompressed: rawCompressed.length,
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    const probe = { produced: 0, fed: 0 };
    const result = await readZipEntry(
      opened.zip,
      "pages/a.json",
      SKETCH_LIMITS.maxPageJsonBytes,
      undefined,
      probe,
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.zipRatioExceeded);
    expect(probe).toEqual({ produced: 0, fed: 0 });
  }, 60_000);

  it("refuses lying sizes: declared 100 bytes, stream inflates more, as corrupt", async () => {
    const rawCompressed = await deflateRaw(randomBytes(3 * MIB));
    const opened = await open([
      {
        name: "pages/a.json",
        data: new Uint8Array(100),
        method: 8,
        rawCompressed,
        declaredSize: 100,
        declaredCompressed: rawCompressed.length,
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    const probe = { produced: 0, fed: 0 };
    const result = await readZipEntry(opened.zip, "pages/a.json", MIB, undefined, probe);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    expect(probe.produced).toBeLessThan(MIB);
    expect(opened.zip.remaining.bytes).toBe(SKETCH_LIMITS.maxTotalBytes);
  }, 60_000);

  it("feeds the compressed bytes in slices of at most 16 KiB and refuses with bounded output", async () => {
    const SLICE = 16 * 1024;
    const CAP = 64 * 1024;
    const rawCompressed = await deflateRaw(randomBytes(8 * MIB));
    expect(rawCompressed.length).toBeGreaterThan(MIB);
    const opened = await open([
      {
        name: "pages/a.json",
        data: new Uint8Array(1),
        method: 8,
        rawCompressed,
        declaredSize: CAP,
        declaredCompressed: rawCompressed.length,
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    const steps: number[] = [];
    let fed = 0;
    const probe = {
      produced: 0,
      get fed(): number {
        return fed;
      },
      set fed(value: number) {
        steps.push(value - fed);
        fed = value;
      },
    };
    const result = await readZipEntry(opened.zip, "pages/a.json", CAP, undefined, probe);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.zipTooLarge);
    expect(steps.length).toBeGreaterThan(1);
    expect(Math.max(...steps)).toBeLessThanOrEqual(SLICE);
    expect(steps.reduce((sum, step) => sum + step, 0)).toBe(fed);
    expect(probe.produced).toBeLessThan(MIB);
  }, 60_000);

  it("refuses an entry whose actual size differs from the declared one", async () => {
    const opened = await open([{ ...deflated("meta.json", "0123456789"), declaredSize: 4 }]);
    if (!opened.ok) throw new Error("expected an index");
    expect((await readZipEntry(opened.zip, "meta.json", MIB)).ok).toBe(false);
  });

  it("refuses an entry above its own cap and a stored entry whose sizes disagree", async () => {
    const opened = await open([
      deflated("meta.json", "x".repeat(2000)),
      { ...stored("a.json", "abc"), declaredSize: 5 },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    expect(messageOf(await readZipEntry(opened.zip, "meta.json", 1000))).toBe(
      DESIGN_IMPORT_MESSAGE.zipTooLarge,
    );
    expect(messageOf(await readZipEntry(opened.zip, "a.json", MIB))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchCorrupt,
    );
  });

  it("refuses a truncated or garbage deflate stream without throwing", async () => {
    const good = await deflateRaw(text("hello hello hello hello"));
    const opened = await open([
      { name: "a.json", data: text("hello"), method: 8, rawCompressed: good.slice(0, 3) },
      {
        name: "b.json",
        data: text("hello"),
        method: 8,
        rawCompressed: new Uint8Array([7, 7, 7, 7, 7, 7]),
      },
    ]);
    if (!opened.ok) throw new Error("expected an index");
    for (const name of ["a.json", "b.json"]) {
      expect(messageOf(await readZipEntry(opened.zip, name, MIB))).toBe(
        DESIGN_IMPORT_MESSAGE.sketchCorrupt,
      );
    }
  });

  it("never inflates an entry that is not asked for, nested zips included", async () => {
    const nested = await buildZip([stored("inner.json")]);
    const poisoned: FixtureEntry = {
      name: "images/nested.zip",
      data: nested,
      method: 8,
      rawCompressed: new Uint8Array([7, 7, 7]),
    };
    const opened = await open([stored("meta.json", "{}"), poisoned]);
    if (!opened.ok) throw new Error("expected an index");
    expect((await readZipEntry(opened.zip, "meta.json", MIB)).ok).toBe(true);
    expect(opened.zip.remaining.bytes).toBe(SKETCH_LIMITS.maxTotalBytes - 2);
  });

  it("refuses an unknown entry name and honors what is left of the total", async () => {
    const opened = await open([stored("meta.json", "{}")]);
    if (!opened.ok) throw new Error("expected an index");
    expect(messageOf(await readZipEntry(opened.zip, "nope.json", MIB))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchCorrupt,
    );
    opened.zip.remaining.bytes = 1;
    expect(messageOf(await readZipEntry(opened.zip, "meta.json", MIB))).toBe(
      DESIGN_IMPORT_MESSAGE.zipTooLarge,
    );
  });

  it("returns the cancelled failure when the signal is already aborted", async () => {
    const opened = await open([deflated("meta.json", "x".repeat(100))]);
    if (!opened.ok) throw new Error("expected an index");
    const controller = new AbortController();
    controller.abort();
    const result = await readZipEntry(opened.zip, "meta.json", MIB, controller.signal);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.cancelled);
  });
});
