import { initializeCanvas, writePsd, type Layer, type Psd } from "ag-psd";
import { describe, expect, it, vi } from "vitest";
import { DesignImportFailure, DesignImportFormat } from "@/lib/shared/design/import/types";
import type { WorkerRequest, WorkerResponse } from "@/lib/shared/design/import/worker/protocol";
import { agPsdEngine } from "@/lib/shared/design/import/worker/psd-engine";
import { type PsdEngine, runPsdRequest } from "@/lib/shared/design/import/worker/psd-runner";
import { WorkerResponseSchema } from "@/lib/shared/design/import/worker/protocol";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

type Posted = { response: WorkerResponse; transfer: ArrayBuffer[] };

const requestOf = (limits = { capacityElements: 200, usedBytes: 0 }): WorkerRequest => ({
  id: 1,
  format: DesignImportFormat.Psd,
  file: new File([new Uint8Array(8)], "a.psd"),
  limits,
});

const run = async (request: WorkerRequest, engine: PsdEngine): Promise<Posted[]> => {
  const posted: Posted[] = [];
  await runPsdRequest(request, engine, (response, transfer) => posted.push({ response, transfer }));
  return posted;
};

const spyEngine = (psd: Psd) => {
  const layerPixels = vi.fn();
  const maskPixels = vi.fn();
  const compositePixels = vi.fn();
  const engine: PsdEngine = {
    readStructure: () => psd,
    source: { layerPixels, maskPixels, compositePixels },
  };
  return { engine, layerPixels, maskPixels, compositePixels };
};

const raw = { colorMode: 3, bitsPerChannel: 8, channels: [], large: false };

const failureOf = (posted: Posted[]) => {
  const last = posted.at(-1)?.response;
  return last?.status === "error" ? last.failure : null;
};

describe("runPsdRequest refusals decode nothing", () => {
  it("refuses 5000 layers without a single decode call", async () => {
    const children: Layer[] = Array.from({ length: 5000 }, () => ({
      left: 0,
      top: 0,
      right: 8,
      bottom: 8,
      rawData: raw,
    }));
    const { engine, layerPixels, maskPixels, compositePixels } = spyEngine({
      width: 100,
      height: 100,
      children,
    });
    const posted = await run(requestOf(), engine);
    expect(failureOf(posted)).toBe(DesignImportFailure.TooManyLayers);
    expect(layerPixels).not.toHaveBeenCalled();
    expect(maskPixels).not.toHaveBeenCalled();
    expect(compositePixels).not.toHaveBeenCalled();
  });

  it("uses the raster budget constant and the store usage", async () => {
    const layer: Layer = { left: 0, top: 0, right: 1024, bottom: 1024, rawData: raw };
    const free = 1024 * 1024 * 4;
    const used = DESIGN_LIMITS.rasterBudgetBytes - free + 4;
    const { engine, layerPixels } = spyEngine({ width: 1024, height: 1024, children: [layer] });
    const posted = await run(requestOf({ capacityElements: 200, usedBytes: used }), engine);
    expect(failureOf(posted)).toBe(DesignImportFailure.Memory);
    expect(layerPixels).not.toHaveBeenCalled();
  });

  it("maps a structure read failure and the memory error text", async () => {
    const corrupt: PsdEngine = {
      readStructure: () => {
        throw new Error("secret file content");
      },
      source: { layerPixels: vi.fn(), maskPixels: vi.fn(), compositePixels: vi.fn() },
    };
    expect(failureOf(await run(requestOf(), corrupt))).toBe(DesignImportFailure.Corrupt);
    const memory: PsdEngine = {
      readStructure: () => {
        throw new Error("Exceeded memory limit");
      },
      source: corrupt.source,
    };
    expect(failureOf(await run(requestOf(), memory))).toBe(DesignImportFailure.Memory);
  });

  it("maps only an allocation RangeError to memory and any other RangeError to corrupt", async () => {
    const throwing = (error: Error): PsdEngine => ({
      readStructure: () => {
        throw error;
      },
      source: { layerPixels: vi.fn(), maskPixels: vi.fn(), compositePixels: vi.fn() },
    });
    const allocation = new RangeError("Array buffer allocation failed");
    expect(failureOf(await run(requestOf(), throwing(allocation)))).toBe(
      DesignImportFailure.Memory,
    );
    const overflow = new RangeError("Maximum call stack size exceeded");
    expect(failureOf(await run(requestOf(), throwing(overflow)))).toBe(DesignImportFailure.Corrupt);
  });

  it("falls back to the composite when every layer decodes to nothing", async () => {
    const layer: Layer = { left: 0, top: 0, right: 8, bottom: 8, rawData: raw };
    const layered: Psd = { width: 64, height: 64, children: [layer] };
    const flat: Psd = { width: 64, height: 64, rawCompositeData: new Uint8Array(4) };
    const readStructure = vi.fn((_buffer: ArrayBuffer, options?: { composite: boolean }) =>
      options?.composite === true ? flat : layered,
    );
    const visible = testImageData(64, 64);
    visible.data.fill(255);
    const compositePixels = vi.fn(() => visible);
    const engine: PsdEngine = {
      readStructure,
      source: { layerPixels: vi.fn(), maskPixels: vi.fn(), compositePixels },
    };
    const posted = await run(requestOf(), engine);
    const last = posted.at(-1)?.response;
    expect(last?.status).toBe("result");
    if (last?.status !== "result") return;
    expect(last.document.flattened).toBe(true);
    expect(last.document.nodes).toHaveLength(1);
    expect(readStructure).toHaveBeenLastCalledWith(expect.any(ArrayBuffer), { composite: true });
  });

  it("reports no layers when nothing decodes and there is no composite", async () => {
    const layer: Layer = { left: 0, top: 0, right: 8, bottom: 8, rawData: raw };
    const psd: Psd = { width: 64, height: 64, children: [layer] };
    const { engine } = spyEngine(psd);
    expect(failureOf(await run(requestOf(), engine))).toBe(DesignImportFailure.NoLayers);
  });

  it("refuses a non-PSD format", async () => {
    const { engine } = spyEngine({ width: 64, height: 64 });
    const request: WorkerRequest = { ...requestOf(), format: DesignImportFormat.Ai };
    expect(failureOf(await run(request, engine))).toBe(DesignImportFailure.Corrupt);
  });
});

const testImageData = (width: number, height: number): ImageData => ({
  width,
  height,
  colorSpace: "srgb",
  data: new Uint8ClampedArray(width * height * 4),
});

describe("runPsdRequest with the real ag-psd engine", () => {
  initializeCanvas(
    () => {
      throw new Error("canvas-unavailable");
    },
    (width, height) => testImageData(width, height),
  );

  const solid = (size: number): ImageData => {
    const image = testImageData(size, size);
    for (let index = 0; index < image.data.length; index += 4) {
      image.data.set([200, 10, 10, 255], index);
    }
    return image;
  };

  it("reads structure, decodes layer by layer and transfers cropped buffers", async () => {
    const written = writePsd({
      width: 64,
      height: 64,
      children: [
        { name: "Fundo", left: 0, top: 0, right: 64, bottom: 64, imageData: solid(64) },
        { name: "Sangra", left: 50, top: 50, right: 80, bottom: 80, imageData: solid(30) },
      ],
    });
    const request: WorkerRequest = { ...requestOf(), file: new File([written], "a.psd") };
    const posted = await run(request, agPsdEngine);
    const result = posted.at(-1)?.response;
    expect(posted.filter((entry) => entry.response.status === "progress")).toHaveLength(2);
    expect(result?.status).toBe("result");
    if (result?.status !== "result") return;
    expect(WorkerResponseSchema.safeParse(result).success).toBe(true);
    const [first, second] = result.document.nodes;
    expect(first?.name).toBe("Fundo");
    expect(second?.box).toEqual({ left: 50, top: 50, width: 14, height: 14 });
    expect(second?.pixels?.byteLength).toBe(14 * 14 * 4);
    expect(posted.at(-1)?.transfer).toHaveLength(2);
  });

  it("reports corrupt bytes without throwing", async () => {
    const posted = await run(requestOf(), agPsdEngine);
    expect(failureOf(posted)).toBe(DesignImportFailure.Corrupt);
  });
});
