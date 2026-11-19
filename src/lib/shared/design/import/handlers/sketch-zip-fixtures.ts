export type FixtureEntry = {
  name: string;
  data: Uint8Array;
  method?: number;
  flags?: number;
  declaredSize?: number;
  declaredCompressed?: number;
  localName?: string;
  rawCompressed?: Uint8Array;
  localOffsetOverride?: number;
};

export type FixtureOptions = {
  entryCount?: number;
  diskNumber?: number;
  comment?: Uint8Array;
  trailing?: Uint8Array;
  skipEnd?: boolean;
  centralStartShift?: number;
};

const encoder = new TextEncoder();

export const deflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data.slice());
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
  }
  const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    joined.set(chunk, position);
    position += chunk.length;
  }
  return joined;
};

const record = (size: number, write: (view: DataView) => void): Uint8Array => {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
};

const join = (parts: readonly Uint8Array[]): Uint8Array => {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) {
    joined.set(part, position);
    position += part.length;
  }
  return joined;
};

type Placed = {
  entry: FixtureEntry;
  nameBytes: Uint8Array;
  payload: Uint8Array;
  method: number;
  offset: number;
};

const localHeader = (placed: Placed): Uint8Array => {
  const { entry, payload, method } = placed;
  const localName = encoder.encode(entry.localName ?? entry.name);
  return join([
    record(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, entry.flags ?? 0, true);
      view.setUint16(8, method, true);
      view.setUint32(18, payload.length, true);
      view.setUint32(22, entry.data.length, true);
      view.setUint16(26, localName.length, true);
    }),
    localName,
    payload,
  ]);
};

const centralHeader = (placed: Placed): Uint8Array => {
  const { entry, nameBytes, payload, method, offset } = placed;
  return join([
    record(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, entry.flags ?? 0, true);
      view.setUint16(10, method, true);
      view.setUint32(20, entry.declaredCompressed ?? payload.length, true);
      view.setUint32(24, entry.declaredSize ?? entry.data.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint32(42, entry.localOffsetOverride ?? offset, true);
    }),
    nameBytes,
  ]);
};

export const buildZip = async (
  entries: readonly FixtureEntry[],
  options: FixtureOptions = {},
): Promise<Uint8Array> => {
  const placed: Placed[] = [];
  const body: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 0;
    const payload =
      entry.rawCompressed ?? (method === 8 ? await deflateRaw(entry.data) : entry.data);
    const next: Placed = { entry, nameBytes: encoder.encode(entry.name), payload, method, offset };
    const bytes = localHeader(next);
    placed.push(next);
    body.push(bytes);
    offset += bytes.length;
  }
  const central = join(placed.map(centralHeader));
  const comment = options.comment ?? new Uint8Array(0);
  const end = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, options.diskNumber ?? 0, true);
    view.setUint16(8, options.entryCount ?? entries.length, true);
    view.setUint16(10, options.entryCount ?? entries.length, true);
    view.setUint32(12, central.length, true);
    view.setUint32(16, offset + (options.centralStartShift ?? 0), true);
    view.setUint16(20, comment.length, true);
  });
  return join([
    ...body,
    central,
    ...(options.skipEnd === true ? [] : [end, comment]),
    options.trailing ?? new Uint8Array(0),
  ]);
};

export const text = (value: string): Uint8Array => encoder.encode(value);
