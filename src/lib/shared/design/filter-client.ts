import type { FilterParams } from "@/lib/shared/design/raster/filter-types";
import type { PixelBuffer, Rect } from "@/lib/shared/design/raster/pixel-buffer";

export type FilterRequest = {
  data: ArrayBuffer;
  width: number;
  height: number;
  inner: Rect;
  params: FilterParams;
};

export type FilterResponse = { data: ArrayBuffer };

export class FilterCancelledError extends Error {
  constructor() {
    super("filter-cancelled");
    this.name = "FilterCancelledError";
  }
}

export type FilterJob = { result: Promise<PixelBuffer>; cancel: () => void };

export const startFilterJob = (crop: PixelBuffer, inner: Rect, params: FilterParams): FilterJob => {
  const worker = new Worker(new URL("./filter.worker.ts", import.meta.url), { type: "module" });
  let abort: (reason: Error) => void = () => undefined;
  const result = new Promise<PixelBuffer>((resolve, reject) => {
    abort = reject;
    worker.onmessage = (event: MessageEvent<FilterResponse>) => {
      worker.terminate();
      resolve({
        width: inner.width,
        height: inner.height,
        data: new Uint8ClampedArray(event.data.data),
      });
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("filter-failed"));
    };
    worker.onmessageerror = () => {
      worker.terminate();
      reject(new Error("filter-failed"));
    };
    const data = new Uint8ClampedArray(crop.data).buffer;
    const request: FilterRequest = { data, width: crop.width, height: crop.height, inner, params };
    worker.postMessage(request, { transfer: [data] });
  });
  return {
    result,
    cancel: () => {
      worker.terminate();
      abort(new FilterCancelledError());
    },
  };
};
