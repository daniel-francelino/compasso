import { describe, expect, it } from "vitest";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFailure } from "@/lib/shared/design/import/types";
import { WorkerResponseSchema, WorkerStatus } from "@/lib/shared/design/import/worker/protocol";
import { documentOf, layerNode, square } from "@/lib/shared/design/import/worker/test-fixtures";
import { validateWorkerDocument } from "@/lib/shared/design/import/worker/validate-document";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const limits = { capacityElements: 200, usedBytes: 0 };

const resultOf = (document: unknown, id = 1) => ({ id, status: WorkerStatus.Result, document });

const messageOf = (result: ReturnType<typeof validateWorkerDocument>) =>
  result.ok ? null : result.message;

describe("WorkerResponseSchema", () => {
  it("accepts progress, result and error", () => {
    const document = documentOf([layerNode("A", square(0, 0, 8))], 64);
    expect(
      WorkerResponseSchema.safeParse({ id: 1, status: WorkerStatus.Progress, done: 1, total: 2 })
        .success,
    ).toBe(true);
    expect(WorkerResponseSchema.safeParse(resultOf(document)).success).toBe(true);
    expect(
      WorkerResponseSchema.safeParse({
        id: 1,
        status: WorkerStatus.Error,
        failure: DesignImportFailure.Memory,
      }).success,
    ).toBe(true);
  });

  it("rejects wrong shapes, extra fields and unknown discriminants", () => {
    const good = documentOf([layerNode("A", square(0, 0, 8))], 64);
    const bad: unknown[] = [
      { id: 1, status: "unknown" },
      { status: WorkerStatus.Progress, done: 0, total: 1 },
      { id: 1, status: WorkerStatus.Progress, done: 2, total: 1 },
      { id: 1, status: WorkerStatus.Error, failure: "other" },
      { ...resultOf(good), extra: 1 },
      resultOf({ ...good, extra: 1 }),
      resultOf({ ...good, width: 5000 }),
      resultOf({ ...good, width: Number.NaN }),
      resultOf({ ...good, width: 64.5 }),
      resultOf({ ...good, width: Number.POSITIVE_INFINITY }),
      resultOf({ ...good, width: -1 }),
      resultOf({ ...good, nodes: [{ ...good.nodes[0], extra: true }] }),
      resultOf({ ...good, nodes: [{ ...good.nodes[0], box: square(0, 0, 5000) }] }),
    ];
    for (const value of bad) expect(WorkerResponseSchema.safeParse(value).success).toBe(false);
  });

  it("rejects a pixel payload that is not a plain ArrayBuffer", () => {
    const good = documentOf([layerNode("A", square(0, 0, 8))], 64);
    const node = good.nodes[0];
    const payloads: unknown[] = [
      new Uint8Array(256),
      new Uint8ClampedArray(256),
      new SharedArrayBuffer(256),
      [1, 2, 3],
    ];
    for (const pixels of payloads) {
      const parsed = WorkerResponseSchema.safeParse(
        resultOf({ ...good, nodes: [{ ...node, pixels }] }),
      );
      expect(parsed.success).toBe(false);
    }
  });
});

describe("validateWorkerDocument", () => {
  it("accepts a consistent document", () => {
    expect(
      validateWorkerDocument(documentOf([layerNode("A", square(0, 0, 8))], 64), limits).ok,
    ).toBe(true);
  });

  it("rejects a buffer whose length is not width times height times 4", () => {
    for (const length of [8 * 8 * 4 - 1, 8 * 8 * 4 + 1, 0]) {
      const node = layerNode("A", square(0, 0, 8), { pixels: new ArrayBuffer(length) });
      const result = validateWorkerDocument(documentOf([node], 64), limits);
      expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    }
  });

  it("rejects a box outside the page, a box without pixels and a flattened mismatch", () => {
    const outside = layerNode("A", square(60, 60, 8));
    expect(messageOf(validateWorkerDocument(documentOf([outside], 64), limits))).toBe(
      DESIGN_IMPORT_MESSAGE.readFailed,
    );
    const half = layerNode("A", square(0, 0, 8), { pixels: null });
    expect(messageOf(validateWorkerDocument(documentOf([half], 64), limits))).toBe(
      DESIGN_IMPORT_MESSAGE.readFailed,
    );
    const two = documentOf([layerNode("A", square(0, 0, 8)), layerNode("B", square(0, 0, 8))], 64, {
      flattened: true,
    });
    expect(messageOf(validateWorkerDocument(two, limits))).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
  });

  it("rejects too many layers even when the worker said it was fine", () => {
    const nodes = Array.from({ length: 3 }, () => layerNode("A", square(0, 0, 8)));
    const result = validateWorkerDocument(documentOf(nodes, 64), {
      ...limits,
      capacityElements: 2,
    });
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(2));
  });

  it("rejects individually valid layers whose sum passes the raster budget", () => {
    const nodes = [layerNode("A", square(0, 0, 8)), layerNode("B", square(0, 0, 8))];
    const used = DESIGN_LIMITS.rasterBudgetBytes - 8 * 8 * 4 - 4;
    const tight = { capacityElements: 200, usedBytes: used };
    expect(messageOf(validateWorkerDocument(documentOf(nodes, 64), tight))).toBe(
      DESIGN_IMPORT_MESSAGE.memory,
    );
    const exact = { capacityElements: 200, usedBytes: used + 4 };
    expect(validateWorkerDocument(documentOf(nodes.slice(0, 1), 64), exact).ok).toBe(true);
    expect(messageOf(validateWorkerDocument(documentOf(nodes, 64), exact))).toBe(
      DESIGN_IMPORT_MESSAGE.memory,
    );
  });

  it("rejects a document with no pixels", () => {
    const result = validateWorkerDocument(documentOf([layerNode("A", null)], 64), limits);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.noLayers);
  });
});
