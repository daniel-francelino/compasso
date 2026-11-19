const be16 = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];
const be32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));
const utf16 = (text: string): number[] =>
  Array.from(text).flatMap((character) => be16(character.charCodeAt(0)));
const float32 = (value: number): number[] => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return [0, 1, 2, 3].map((index) => view.getUint8(index));
};

export type AseEntry =
  | { kind: "group"; name: string }
  | { kind: "end" }
  | { kind: "color"; name: string; model: "RGB " | "CMYK" | "LAB " | "Gray"; values: number[] };

const nameField = (name: string): number[] => [...be16(name.length + 1), ...utf16(name), 0, 0];

const aseBlock = (entry: AseEntry): number[] => {
  if (entry.kind === "end") return [...be16(0xc002), ...be32(0)];
  if (entry.kind === "group") {
    const body = nameField(entry.name);
    return [...be16(0xc001), ...be32(body.length), ...body];
  }
  const body = [
    ...nameField(entry.name),
    ...ascii(entry.model),
    ...entry.values.flatMap(float32),
    ...be16(2),
  ];
  return [...be16(0x0001), ...be32(body.length), ...body];
};

export const aseBytes = (
  entries: readonly AseEntry[],
  options: { declaredBlocks?: number } = {},
): Uint8Array<ArrayBuffer> =>
  Uint8Array.from([
    ...ascii("ASEF"),
    ...be16(1),
    ...be16(0),
    ...be32(options.declaredBlocks ?? entries.length),
    ...entries.flatMap(aseBlock),
  ]);

export type AcoEntry = { space: number; values: [number, number, number, number]; name?: string };

export const acoBytes = (
  entries: readonly AcoEntry[],
  options: { version?: 1 | 2 | 3; declaredCount?: number; nameChars?: number } = {},
): Uint8Array<ArrayBuffer> => {
  const v1 = [
    ...be16(1),
    ...be16(options.declaredCount ?? entries.length),
    ...entries.flatMap((entry) => [...be16(entry.space), ...entry.values.flatMap(be16)]),
  ];
  const v2 = [
    ...be16(2),
    ...be16(options.declaredCount ?? entries.length),
    ...entries.flatMap((entry) => {
      const name = entry.name ?? "";
      return [
        ...be16(entry.space),
        ...entry.values.flatMap(be16),
        ...be16(0),
        ...be16(options.nameChars ?? name.length + 1),
        ...utf16(name),
        0,
        0,
      ];
    }),
  ];
  if (options.version === 1) return Uint8Array.from(v1);
  if (options.version === 2) return Uint8Array.from(v2);
  return Uint8Array.from([...v1, ...v2]);
};

export const gplBytes = (lines: readonly string[]): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(ascii(lines.join("\n")));
