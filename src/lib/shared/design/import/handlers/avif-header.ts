import { ftypBrands } from "@/lib/shared/design/import/sniff";

const BOX_HEADER = 8;
const LARGE_BOX_HEADER = 16;
const FULL_BOX_EXTRA = 4;
const MAX_DEPTH = 16;
const MAX_BOXES = 4096;
const ISPE_PAYLOAD = 8;

type AvifInfo = {
  width: number;
  height: number;
  largestPixels: number;
  animated: boolean;
  ambiguous: boolean;
};

type Box = {
  type: string;
  start: number;
  payload: number;
  end: number;
  truncated: boolean;
};

const typeAt = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );

const largeTotal = (view: DataView, offset: number, limit: number): number | null => {
  if (offset + LARGE_BOX_HEADER > limit) return null;
  const high = view.getUint32(offset + BOX_HEADER, false);
  const low = view.getUint32(offset + BOX_HEADER + 4, false);
  const total = high * 2 ** 32 + low;
  return Number.isSafeInteger(total) && total >= LARGE_BOX_HEADER ? total : null;
};

const readBox = (view: DataView, bytes: Uint8Array, offset: number, limit: number): Box | null => {
  if (offset + BOX_HEADER > limit) return null;
  const size = view.getUint32(offset, false);
  const type = typeAt(bytes, offset + 4);
  const large = size === 1;
  const total = large ? largeTotal(view, offset, limit) : size;
  const header = large ? LARGE_BOX_HEADER : BOX_HEADER;
  if (total === null || (total !== 0 && total < header)) return null;
  const end = total === 0 ? limit : Math.min(limit, offset + total);
  const truncated = total === 0 || offset + total > limit;
  return { type, start: offset, payload: offset + header, end, truncated };
};

type Walk = { view: DataView; bytes: Uint8Array; sizes: Array<[number, number]>; boxes: number };

const visit = (state: Walk, box: Box, path: readonly string[], depth: number): boolean => {
  const wanted = path[0];
  const onPath = box.type === wanted || (wanted === undefined && box.type === "ispe");
  if (onPath && box.truncated) return false;
  if (wanted !== undefined && box.type === wanted) {
    const inner = wanted === "meta" ? box.payload + FULL_BOX_EXTRA : box.payload;
    return walk(state, inner, box.end, path.slice(1), depth + 1);
  }
  if (wanted !== undefined || box.type !== "ispe") return true;
  const base = box.payload + FULL_BOX_EXTRA;
  if (base + ISPE_PAYLOAD > box.end) return false;
  state.sizes.push([state.view.getUint32(base, false), state.view.getUint32(base + 4, false)]);
  return true;
};

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
    if (!visit(state, box, path, depth)) return false;
    offset = box.end;
  }
  return true;
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
    ambiguous: new Set(state.sizes.map(([w, h]) => `${w}x${h}`)).size > 1,
    animated: ftypBrands(bytes).includes("avis"),
  };
};
