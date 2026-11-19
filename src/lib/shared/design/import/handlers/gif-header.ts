const HEADER_BYTES = 13;
const WIDTH_OFFSET = 6;
const HEIGHT_OFFSET = 8;
const FLAGS_OFFSET = 10;
const EXTENSION = 0x21;
const IMAGE = 0x2c;
const TRAILER = 0x3b;
const IMAGE_DESCRIPTOR_BYTES = 9;
const MAX_BLOCKS = 100_000;

export type GifInfo = {
  width: number;
  height: number;
  frames: number;
  extentWidth: number;
  extentHeight: number;
};

type Extent = { width: number; height: number };

const tableBytes = (flags: number): number => (flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0);

const skipSubBlocks = (bytes: Uint8Array, start: number, budget: { blocks: number }): number => {
  let position = start;
  for (;;) {
    budget.blocks += 1;
    if (budget.blocks > MAX_BLOCKS || position >= bytes.length) return -1;
    const size = bytes[position] ?? 0;
    position += 1;
    if (size === 0) return position;
    position += size;
    if (position > bytes.length) return -1;
  }
};

const skipImage = (
  bytes: Uint8Array,
  position: number,
  budget: { blocks: number },
  extent: Extent,
): number => {
  if (position + IMAGE_DESCRIPTOR_BYTES + 1 > bytes.length) return -1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  extent.width = Math.max(
    extent.width,
    view.getUint16(position, true) + view.getUint16(position + 4, true),
  );
  extent.height = Math.max(
    extent.height,
    view.getUint16(position + 2, true) + view.getUint16(position + 6, true),
  );
  const local = tableBytes(bytes[position + IMAGE_DESCRIPTOR_BYTES - 1] ?? 0);
  return skipSubBlocks(bytes, position + IMAGE_DESCRIPTOR_BYTES + local + 1, budget);
};

export const readGifInfo = (bytes: Uint8Array): GifInfo | null => {
  if (bytes.length < HEADER_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(WIDTH_OFFSET, true);
  const height = view.getUint16(HEIGHT_OFFSET, true);
  if (width === 0 || height === 0) return null;
  let position = HEADER_BYTES + tableBytes(bytes[FLAGS_OFFSET] ?? 0);
  const budget = { blocks: 0 };
  let frames = 0;
  const extent: Extent = { width, height };
  while (position < bytes.length) {
    const marker = bytes[position];
    position += 1;
    if (marker === TRAILER) break;
    if (marker === EXTENSION) {
      position = skipSubBlocks(bytes, position + 1, budget);
    } else if (marker === IMAGE) {
      frames += 1;
      position = skipImage(bytes, position, budget, extent);
    } else {
      return null;
    }
    if (position < 0) return null;
  }
  return frames === 0
    ? null
    : { width, height, frames, extentWidth: extent.width, extentHeight: extent.height };
};
