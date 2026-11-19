import { deflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

const { rawTiff, tiffBytes } = await import("@/lib/shared/design/import/handlers/format-fixtures");
const { isUtifLike, runTiff } = await import("@/lib/shared/design/import/worker/tiff-engine");
const { TiffRefusal, readTiffInfo } = await import("@/lib/shared/design/import/worker/tiff-header");

const loaded: unknown = await import("utif2");
const real: unknown =
  typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
if (!isUtifLike(real)) throw new Error("utif2 did not load");

const spied = () => {
  const decode = vi.fn(real.decode.bind(real));
  const decodeImage = vi.fn(real.decodeImage.bind(real));
  return {
    decode,
    decodeImage,
    utif: { decode, decodeImage, toRGBA8: real.toRGBA8.bind(real) },
  };
};

const bufferOf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

const SHORT = 3;
const LONG = 4;

const baseEntries = (extra: Array<{ tag: number; type: number; count: number; value: number }>) => {
  const all = [
    { tag: 256, type: LONG, count: 1, value: 4 },
    { tag: 257, type: LONG, count: 1, value: 4 },
    { tag: 258, type: SHORT, count: 1, value: 8 },
    { tag: 259, type: SHORT, count: 1, value: 1 },
    { tag: 262, type: SHORT, count: 1, value: 1 },
    { tag: 277, type: SHORT, count: 1, value: 1 },
    { tag: 278, type: LONG, count: 1, value: 4 },
    { tag: 279, type: LONG, count: 1, value: 16 },
    ...extra,
  ];
  const offset = 8 + 2 + (all.length + 1) * 12 + 4;
  return [...all, { tag: 273, type: LONG, count: 1, value: offset }];
};

const grayFile = (extra: Parameters<typeof baseEntries>[0] = []) =>
  rawTiff(baseEntries(extra), new Uint8Array(16).fill(200));

describe("hostile TIFF files through the real utif2", () => {
  it("decodes a valid uncompressed gray file", async () => {
    const { utif } = spied();
    const out = await runTiff(1, bufferOf(grayFile()), 0, utif);
    expect(out.response.status).toBe("result");
    if (out.response.status !== "result") return;
    expect([...new Uint8Array(out.response.pixels).subarray(0, 4)]).toEqual([200, 200, 200, 255]);
  });

  it("decodes a valid RGB file", async () => {
    const { utif } = spied();
    const out = await runTiff(
      1,
      bufferOf(tiffBytes(4, 4, { stripData: new Uint8Array(48).fill(90) })),
      0,
      utif,
    );
    expect(out.response.status).toBe("result");
  });

  it("refuses a tag with count 0xFFFFFFFF before utif2 runs", async () => {
    const s = spied();
    const file = grayFile([{ tag: 34665, type: LONG, count: 0xffffffff, value: 0 }]);
    const out = await runTiff(1, bufferOf(file), 0, s.utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.Corrupt });
    expect(s.decode).not.toHaveBeenCalled();
  });

  it("refuses duplicate tags before utif2 runs", async () => {
    const s = spied();
    const file = grayFile([{ tag: 259, type: SHORT, count: 1, value: 7 }]);
    const out = await runTiff(1, bufferOf(file), 0, s.utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.Corrupt });
    expect(s.decode).not.toHaveBeenCalled();
  });

  it("refuses compression 7 and a huge SamplesPerPixel as unsupported", async () => {
    for (const bad of [
      [{ tag: 259, type: SHORT, count: 1, value: 7 }],
      [{ tag: 277, type: SHORT, count: 1, value: 60000 }],
    ]) {
      const unsupported = bad[0]?.tag === 259;
      const s = spied();
      const base = baseEntries([]).filter((entry) => !bad.some((b) => b.tag === entry.tag));
      const offset = 8 + 2 + (base.length + bad.length) * 12 + 4;
      const entries = [
        ...base.filter((e) => e.tag !== 273),
        ...bad,
        base.find((e) => e.tag === 273),
      ];
      const fixed = entries.flatMap((entry) =>
        entry === undefined ? [] : [entry.tag === 273 ? { ...entry, value: offset } : entry],
      );
      const out = await runTiff(1, bufferOf(rawTiff(fixed, new Uint8Array(16))), 0, s.utif);
      expect(out.response).toMatchObject({
        status: "error",
        refusal: unsupported ? TiffRefusal.Unsupported : TiffRefusal.Corrupt,
      });
      expect(s.decode).not.toHaveBeenCalled();
    }
  });

  it("never lets utif2 parse a SubIFD, EXIF or GPS pointer: the rebuilt file has only the validated tags", async () => {
    const s = spied();
    const file = grayFile([
      { tag: 330, type: LONG, count: 1, value: 8 },
      { tag: 34665, type: LONG, count: 1, value: 8 },
      { tag: 34853, type: LONG, count: 1, value: 8 },
    ]);
    const out = await runTiff(1, bufferOf(file), 0, s.utif);
    expect(out.response.status).toBe("result");
    const handed = s.decode.mock.calls[0]?.[0];
    expect(handed).toBeDefined();
    if (handed === undefined) return;
    expect(new DataView(handed).getUint16(8, true)).toBe(11);
    expect(s.decode.mock.calls[0]?.[1]).toEqual({ parseMN: false });
  });

  it("refuses an IFD chain that loops", async () => {
    const s = spied();
    const out = await runTiff(1, bufferOf(tiffBytes(4, 4, { loop: true })), 0, s.utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.Corrupt });
    expect(s.decode).not.toHaveBeenCalled();
  });

  it("inflates a Deflate strip within its expected size", async () => {
    const { utif } = spied();
    const file = tiffBytes(4, 4, {
      compression: 8,
      stripData: new Uint8Array(deflateSync(Buffer.alloc(48, 120))),
    });
    const out = await runTiff(1, bufferOf(file), 0, utif);
    expect(out.response.status).toBe("result");
  });

  it("stops a Deflate bomb with a lying declared size with bounded work", async () => {
    const s = spied();
    const bomb = new Uint8Array(deflateSync(Buffer.alloc(96 * 1024 * 1024)));
    const file = tiffBytes(4, 4, { compression: 8, stripData: bomb });
    const started = Date.now();
    const out = await runTiff(1, bufferOf(file), 0, s.utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.Corrupt });
    expect(s.decode).not.toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(5000);
  }, 15000);
});

const ENTRY_COUNT = 9;
const TABLES_AT = 8 + 2 + ENTRY_COUNT * 12 + 4;

type StripTable = { offset: (index: number) => number; count: (index: number) => number };

const stripTableFile = (
  strips: number,
  compression: number,
  table: StripTable,
  dataBytes: number,
): Uint8Array => {
  const dataAt = TABLES_AT + strips * 8;
  const tail = new Uint8Array(strips * 8 + dataBytes);
  const view = new DataView(tail.buffer);
  for (let index = 0; index < strips; index += 1) {
    view.setUint32(index * 4, dataAt + table.offset(index), true);
    view.setUint32(strips * 4 + index * 4, table.count(index), true);
  }
  const entries = [
    { tag: 256, type: LONG, count: 1, value: 1 },
    { tag: 257, type: LONG, count: 1, value: strips },
    { tag: 258, type: SHORT, count: 1, value: 8 },
    { tag: 259, type: SHORT, count: 1, value: compression },
    { tag: 262, type: SHORT, count: 1, value: 1 },
    { tag: 273, type: LONG, count: strips, value: TABLES_AT },
    { tag: 277, type: SHORT, count: 1, value: 1 },
    { tag: 278, type: LONG, count: 1, value: 1 },
    { tag: 279, type: LONG, count: strips, value: TABLES_AT + strips * 4 },
  ];
  return rawTiff(entries, tail);
};

const LZW = 5;
const PACKBITS = 32773;

describe("TIFF strip layout rules (real header, real utif2)", () => {
  const expectRefused = async (file: Uint8Array) => {
    const header = readTiffInfo(file);
    expect(header).toEqual({ ok: false, refusal: TiffRefusal.Corrupt });
    const s = spied();
    const buffer = bufferOf(file);
    const sliced = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      const out = await runTiff(1, buffer, 0, s.utif);
      expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.Corrupt });
      expect(sliced).not.toHaveBeenCalled();
    } finally {
      sliced.mockRestore();
    }
    expect(s.decode).not.toHaveBeenCalled();
  };

  it("refuses 32768 LZW strips that all point at the same 3 MB range", async () => {
    const three = 3 * 1024 * 1024;
    await expectRefused(stripTableFile(32768, LZW, { offset: () => 0, count: () => three }, three));
  }, 30000);

  it("refuses small overlapping strips (so the size cap is not what stops it)", async () => {
    await expectRefused(stripTableFile(64, PACKBITS, { offset: () => 0, count: () => 100 }, 100));
  }, 30000);

  it("refuses strips listed out of offset order even when they do not overlap", async () => {
    const reversed = { offset: (index: number) => (1 - index) * 8, count: () => 8 };
    await expectRefused(stripTableFile(2, LZW, reversed, 16));
  });

  it("refuses a compressed strip larger than twice its raw size plus slack", async () => {
    const table = {
      offset: (index: number) => index * 5000,
      count: (index: number) => 5000 - index * 5000,
    };
    await expectRefused(stripTableFile(2, LZW, table, 5000));
  });

  it("accepts sorted, adjacent strips at the cap boundary and refuses one byte more", () => {
    const edge = 1 * 2 + 1024;
    const at = (first: number) =>
      stripTableFile(
        2,
        LZW,
        { offset: (index) => index * first, count: (index) => (index === 0 ? first : 0) },
        first,
      );
    expect(readTiffInfo(at(edge)).ok).toBe(true);
    expect(readTiffInfo(at(edge + 1)).ok).toBe(false);
  });
});

describe("TIFF byte order", () => {
  const SAMPLES = [0x12, 0x34, 0xab, 0xcd];
  const gray16 = (bigEndian: boolean) =>
    tiffBytes(2, 1, {
      bits: 16,
      samples: 1,
      photometric: 1,
      bigEndian,
      stripData: Uint8Array.from(bigEndian ? SAMPLES : [0x34, 0x12, 0xcd, 0xab]),
    });

  const pixelsOf = async (file: Uint8Array): Promise<number[]> => {
    const { utif } = spied();
    const out = await runTiff(1, bufferOf(file), 0, utif);
    if (out.response.status !== "result") throw new Error("expected a result");
    return [...new Uint8Array(out.response.pixels)];
  };

  it("decodes a big-endian 16-bit file to the same pixels as the little-endian twin", async () => {
    const little = await pixelsOf(gray16(false));
    const big = await pixelsOf(gray16(true));
    expect(big).toEqual(little);
    expect(big[0]).not.toBe(big[4]);
  });

  it("rebuilds the file in the source byte order", async () => {
    const s = spied();
    await runTiff(1, bufferOf(gray16(true)), 0, s.utif);
    const handed = new Uint8Array(s.decode.mock.calls[0]?.[0] ?? new ArrayBuffer(0));
    expect([...handed.subarray(0, 4)]).toEqual([0x4d, 0x4d, 0, 42]);
  });
});
