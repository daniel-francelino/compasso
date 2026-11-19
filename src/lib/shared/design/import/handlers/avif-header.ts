const BOX_HEADER = 8;
const LARGE_BOX_HEADER = 16;
const FULL_BOX_EXTRA = 4;
const MAX_DEPTH = 16;
const MAX_BOXES = 4096;
const ISPE_PAYLOAD = 8;

export type AvifInfo = { width: number; height: number; largestPixels: number; animated: boolean };

type Box = { type: string; start: number; payload: number; end: number };

const typeAt = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );

const readBox = (view: DataView, bytes: Uint8Array, offset: number, limit: number): Box | null => {
  if (offset + BOX_HEADER > limit) return null;
  const size = view.getUint32(offset, false);
  const type = typeAt(bytes, offset + 4);
  if (size === 0) return { type, start: offset, payload: offset + BOX_HEADER, end: limit };
  if (size === 1) {
    if (offset + LARGE_BOX_HEADER > limit) return null;
    const high = view.getUint32(offset + BOX_HEADER, false);
    const low = view.getUint32(offset + BOX_HEADER + 4, false);
    const total = high * 2 ** 32 + low;
    if (!Number.isSafeInteger(total) || total < LARGE_BOX_HEADER) return null;
    return {
      type,
      start: offset,
      payload: offset + LARGE_BOX_HEADER,
      end: Math.min(limit, offset + total),
    };
  }
  if (size < BOX_HEADER) return null;
  return { type, start: offset, payload: offset + BOX_HEADER, end: Math.min(limit, offset + size) };
};

type Walk = { view: DataView; bytes: Uint8Array; sizes: Array<[number, number]>; boxes: number };

const walk = (
  state: Walk,
  from: number,
  to: number,
  path: readonly string[],
  depth: number,
): boolean => {
  if (depth > MAX_DEPTH) return false;
  let offset = from;
  while (offset < to) {
    state.boxes += 1;
    if (state.boxes > MAX_BOXES) return false;
    const box = readBox(state.view, state.bytes, offset, to);
    if (box === null || box.end <= offset) return false;
    const wanted = path[0];
    if (wanted !== undefined && box.type === wanted) {
      const inner = wanted === "meta" ? box.payload + FULL_BOX_EXTRA : box.payload;
      if (!walk(state, inner, box.end, path.slice(1), depth + 1)) return false;
    } else if (wanted === undefined && box.type === "ispe") {
      if (box.payload + FULL_BOX_EXTRA + ISPE_PAYLOAD > box.end) return false;
      const base = box.payload + FULL_BOX_EXTRA;
      state.sizes.push([state.view.getUint32(base, false), state.view.getUint32(base + 4, false)]);
    }
    offset = box.end;
  }
  return true;
};

const hasBrand = (bytes: Uint8Array, brand: string): boolean => {
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  const end = Math.min(size, bytes.length);
  for (let offset = 8; offset + 4 <= end; offset += offset === 8 ? 8 : 4) {
    if (typeAt(bytes, offset) === brand) return true;
  }
  return false;
};

export const readAvifInfo = (bytes: Uint8Array): AvifInfo | null => {
  if (bytes.length < BOX_HEADER * 2) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const state: Walk = { view, bytes, sizes: [], boxes: 0 };
  if (!walk(state, 0, bytes.length, ["meta", "iprp", "ipco"], 0)) return null;
  const first = state.sizes[0];
  if (first === undefined || first[0] === 0 || first[1] === 0) return null;
  const largestPixels = state.sizes.reduce((most, [w, h]) => Math.max(most, w * h), 0);
  return {
    width: first[0],
    height: first[1],
    largestPixels,
    animated: hasBrand(bytes, "avis"),
  };
};
