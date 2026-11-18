import type { WorkerDocument, WorkerNode } from "@/lib/shared/design/import/worker/protocol";

export const counter = () => {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
};

export const pixelBuffer = (
  width: number,
  height: number,
  rgba: [number, number, number, number] = [200, 10, 10, 255],
): ArrayBuffer => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set(rgba, index);
  return data.buffer;
};

export const layerNode = (
  name: string,
  box: { left: number; top: number; width: number; height: number } | null,
  extra: Partial<WorkerNode> = {},
): WorkerNode => ({
  group: false,
  depth: 0,
  name,
  hidden: false,
  opened: true,
  opacity: 1,
  fillOpacity: 1,
  blendMode: "normal",
  clipping: false,
  text: false,
  smartObject: false,
  effects: false,
  adjustment: false,
  box,
  pixels: box === null ? null : pixelBuffer(box.width, box.height),
  ...extra,
});

export const groupNode = (name: string, depth: number, extra: Partial<WorkerNode> = {}) =>
  layerNode(name, null, { group: true, depth, blendMode: "pass through", ...extra });

export const square = (left: number, top: number, size: number) => ({
  left,
  top,
  width: size,
  height: size,
});

export const documentOf = (
  nodes: WorkerNode[],
  size = 200,
  extra: Partial<WorkerDocument> = {},
): WorkerDocument => ({
  width: size,
  height: size,
  depthReduced: false,
  cmyk: false,
  flattened: false,
  nodes,
  ...extra,
});

export const psdHeader = (version: number, width: number, height: number, mode: number) => {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  bytes.set([0x38, 0x42, 0x50, 0x53]);
  view.setUint16(4, version);
  view.setUint32(14, height);
  view.setUint32(18, width);
  view.setUint16(22, 8);
  view.setUint16(24, mode);
  return bytes;
};
