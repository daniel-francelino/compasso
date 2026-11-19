export const inflateBounded = async (
  compressed: Uint8Array<ArrayBuffer>,
  maxBytes: number,
): Promise<Uint8Array | null> => {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate"));
  const reader = stream.getReader();
  const out = new Uint8Array(maxBytes);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return out.subarray(0, length);
      if (length + value.length > maxBytes) {
        await reader.cancel();
        return null;
      }
      out.set(value, length);
      length += value.length;
    }
  } catch {
    return null;
  }
};
