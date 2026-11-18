import { initializeCanvas, writePsd, type Layer } from "ag-psd";
import { describe, expect, it, vi } from "vitest";
import { psdToDesign, readPsdHeader } from "@/lib/shared/design/import/handlers/psd";
import { planPsd } from "@/lib/shared/design/import/handlers/psd-plan";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFailure, DesignImportFormat } from "@/lib/shared/design/import/types";
import {
  WorkerResponseSchema,
  type WorkerRequest,
  type WorkerResponse,
} from "@/lib/shared/design/import/worker/protocol";
import { agPsdEngine } from "@/lib/shared/design/import/worker/psd-engine";
import { runPsdRequest } from "@/lib/shared/design/import/worker/psd-runner";
import {
  counter,
  documentOf,
  layerNode,
  psdHeader,
  square,
} from "@/lib/shared/design/import/worker/test-fixtures";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const messageOf = (result: { ok: boolean; message?: string }): string | null =>
  result.ok ? null : (result.message ?? null);

describe("readPsdHeader hostile heads", () => {
  it("refuses a 25-byte head as corrupt without throwing", () => {
    const head = psdHeader(1, 100, 100, 3).subarray(0, 25);
    expect(messageOf(readPsdHeader(head))).toBe(DESIGN_IMPORT_MESSAGE.corrupt);
  });

  it("accepts only the documented color modes 0..4 and refuses 5..9", () => {
    for (const mode of [0, 1, 2, 3, 4])
      expect(readPsdHeader(psdHeader(1, 100, 100, mode)).ok).toBe(true);
    for (const mode of [5, 6, 7, 8, 9, 0xffff]) {
      expect(messageOf(readPsdHeader(psdHeader(1, 100, 100, mode)))).toBe(
        DESIGN_IMPORT_MESSAGE.psdColorMode,
      );
    }
  });

  it("does not refuse by bit depth at the header (depth is reduced later)", () => {
    for (const depth of [1, 8, 16, 32]) {
      const head = psdHeader(1, 100, 100, 3);
      new DataView(head.buffer).setUint16(22, depth);
      const result = readPsdHeader(head);
      expect(result.ok && result.header.depth).toBe(depth);
    }
  });

  it("reads a subarray head at its own byte offset", () => {
    const wrapped = new Uint8Array(40);
    wrapped.set(psdHeader(1, 300, 200, 3), 7);
    const result = readPsdHeader(wrapped.subarray(7, 33));
    expect(result.ok && [result.header.width, result.header.height]).toEqual([300, 200]);
  });
});

describe("planPsd declared layer count", () => {
  it("refuses 65535 declared leaf layers at the capacity without planning them all", () => {
    const raw = { colorMode: 3, bitsPerChannel: 8, channels: [], large: false };
    const children: Layer[] = Array.from({ length: 65535 }, () => ({
      left: 0,
      top: 0,
      right: 2,
      bottom: 2,
      rawData: raw,
    }));
    const result = planPsd(
      { width: 64, height: 64, children },
      {
        capacityElements: DESIGN_LIMITS.maxElements,
        remainingBytes: DESIGN_LIMITS.rasterBudgetBytes,
        maxLayerSide: DESIGN_IMPORT_LIMITS.maxLayerSide,
      },
    );
    expect(!result.ok && result.failure).toBe(DesignImportFailure.TooManyLayers);
  });
});

describe("psdToDesign hostile content", () => {
  it("omits notes whose count is zero and keeps a stable order", () => {
    const result = psdToDesign(
      documentOf([
        layerNode("A", square(0, 0, 8), { text: true }),
        layerNode("B", square(8, 0, 8), { text: true, effects: true }),
        layerNode("C", square(16, 0, 8), { text: true }),
      ]),
      { newId: counter() },
    );
    expect(result.ok && result.design.notes).toEqual([
      { kind: "text_as_pixels", count: 3 },
      { kind: "layer_style_dropped", count: 1 },
    ]);
  });

  it("caps a 400 KB layer name and never leaves a lone surrogate", () => {
    const emoji = String.fromCodePoint(0x1f600);
    const name = emoji.repeat(200_000);
    const result = psdToDesign(documentOf([layerNode(name, square(0, 0, 8))]), {
      newId: counter(),
    });
    const element = result.ok ? result.design.elements[0] : undefined;
    expect(Array.from(element?.name ?? "").length).toBeLessThanOrEqual(DESIGN_LIMITS.layerNameMax);
    expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(element?.name ?? "")).toBe(false);
  });

  it("drops a first layer's clipping flag and counts it", () => {
    const result = psdToDesign(documentOf([layerNode("A", square(0, 0, 8), { clipping: true })]), {
      newId: counter(),
    });
    expect(result.ok && result.design.notes).toEqual([{ kind: "clipping_partial", count: 1 }]);
  });
});

describe("truncated PSD through the real structure reader", () => {
  initializeCanvas(
    () => {
      throw new Error("canvas-unavailable");
    },
    (width, height) =>
      ({
        width,
        height,
        colorSpace: "srgb",
        data: new Uint8ClampedArray(width * height * 4).fill(255),
      }) as ImageData,
  );

  const image = (size: number): ImageData =>
    ({
      width: size,
      height: size,
      colorSpace: "srgb",
      data: new Uint8ClampedArray(size * size * 4).fill(200),
    }) as ImageData;

  const written = writePsd({
    width: 64,
    height: 64,
    children: [{ name: "A", left: 0, top: 0, right: 64, bottom: 64, imageData: image(64) }],
  });

  const runCut = async (cut: number): Promise<WorkerResponse[]> => {
    const request: WorkerRequest = {
      id: 1,
      format: DesignImportFormat.Psd,
      file: new File([written.slice(0, cut)], "a.psd"),
      limits: { capacityElements: 200, usedBytes: 0 },
    };
    const posted: WorkerResponse[] = [];
    await runPsdRequest(request, agPsdEngine, (response) => posted.push(response));
    return posted;
  };

  it("never throws and answers with one valid terminal response for every cut point", async () => {
    const cuts = [0, 4, 10, 25, 26, 30, 40, 60, 100, Math.floor(written.byteLength / 2)];
    for (const cut of cuts) {
      const posted = await runCut(cut);
      const last = posted.at(-1);
      expect(WorkerResponseSchema.safeParse(last).success).toBe(true);
      expect(["error", "result"]).toContain(last?.status);
    }
  });

  it("answers corrupt (not memory) for cuts inside the header and the early sections", async () => {
    for (const cut of [0, 4, 10, 25]) {
      const last = (await runCut(cut)).at(-1);
      expect(last?.status === "error" && last.failure).toBe(DesignImportFailure.Corrupt);
    }
  });

  it("answers a failure (corrupt or memory) for cuts inside the header", async () => {
    for (const cut of [0, 4, 10, 25]) {
      const last = (await runCut(cut)).at(-1);
      expect(last?.status).toBe("error");
    }
  });

  it("never reports a progress for a decode that cannot happen when cut before the layer data", async () => {
    const report = vi.fn();
    const posted = await runCut(26);
    for (const response of posted) report(response.status);
    expect(report).not.toHaveBeenCalledWith("progress");
  });
});
