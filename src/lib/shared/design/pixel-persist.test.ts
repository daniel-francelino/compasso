import { describe, expect, it } from "vitest";
import { createRasterLayer, rasterPixelsIds } from "@/lib/shared/design/document";
import { historyOf, pushHistory } from "@/lib/shared/design/history";
import {
  claimPixelOwners,
  duplicatedPixelIds,
  layersDueForFlush,
  pendingPixelIds,
  pixelFileName,
  pixelRefsOf,
  retargetHistory,
  withPixelsVersion,
} from "@/lib/shared/design/pixel-persist";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { isPixelStep, markPixelStep } from "@/lib/shared/design/timeline";

const PAGE = { id: "p1", background: null, elements: [] };
const VERSION = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const documentWith = (...ids: string[]): DesignDocument => ({
  version: 3,
  pages: [
    {
      ...PAGE,
      elements: ids.map((id) => createRasterLayer(id, PAGE, { width: 100, height: 50 })),
    },
  ],
});

describe("withPixelsVersion", () => {
  it("sets the version of one raster layer", () => {
    const next = withPixelsVersion(documentWith("a", "b"), "a", VERSION);
    const ids = next.pages[0]?.elements.map((element) =>
      element.kind === "raster" ? element.pixelsVersionId : undefined,
    );
    expect(ids).toEqual([VERSION, null]);
  });

  it("returns the same document when nothing changes", () => {
    const document = documentWith("a");
    expect(withPixelsVersion(document, "missing", VERSION)).toBe(document);
    const patched = withPixelsVersion(document, "a", VERSION);
    expect(withPixelsVersion(patched, "a", VERSION)).toBe(patched);
  });

  it("keeps the pixel step marker", () => {
    const marked = markPixelStep(documentWith("a"), "Pincel", "step-1");
    expect(isPixelStep(withPixelsVersion(marked, "a", VERSION))).toBe(true);
  });
});

describe("retargetHistory", () => {
  it("patches past, present and future without adding a step", () => {
    const first = documentWith("a");
    const second = documentWith("a", "b");
    const history = pushHistory(historyOf(first), second, 50);
    const next = retargetHistory(history, [{ id: "a", versionId: VERSION }]);
    expect(next.past).toHaveLength(1);
    expect(next.future).toHaveLength(0);
    const present = next.present.pages[0]?.elements[0];
    const past = next.past[0]?.pages[0]?.elements[0];
    expect(present?.kind === "raster" && present.pixelsVersionId).toBe(VERSION);
    expect(past?.kind === "raster" && past.pixelsVersionId).toBe(VERSION);
  });
});

describe("pendingPixelIds", () => {
  it("keeps only dirty ids that are in the document", () => {
    expect(pendingPixelIds(documentWith("a", "b"), ["b", "gone"])).toEqual(["b"]);
  });
});

describe("duplicated pixels", () => {
  it("flags a layer sharing a file owned by another layer", () => {
    const base = withPixelsVersion(documentWith("a"), "a", VERSION);
    const owners = new Map<string, string>();
    claimPixelOwners(base, owners);
    const copy = documentWith("a", "b");
    const shared = withPixelsVersion(withPixelsVersion(copy, "a", VERSION), "b", VERSION);
    expect(duplicatedPixelIds(shared, owners)).toEqual(["b"]);
    expect(duplicatedPixelIds(base, owners)).toEqual([]);
    const own = withPixelsVersion(shared, "b", OTHER);
    expect(duplicatedPixelIds(own, owners)).toEqual([]);
  });
});

describe("layersDueForFlush", () => {
  it("skips layers sent less than the minimum gap ago", () => {
    const sent = new Map([["a", 10_000]]);
    expect(layersDueForFlush(["a", "b"], sent, 20_000, 15_000)).toEqual(["b"]);
    expect(layersDueForFlush(["a", "b"], sent, 25_000, 15_000)).toEqual(["a", "b"]);
  });
});

describe("pixelFileName", () => {
  it("is unique per suffix", () => {
    expect(pixelFileName("abcdef123456", "x1")).toBe("camada-abcdef12-x1.png");
    expect(pixelFileName("abcdef123456", "x2")).not.toBe(pixelFileName("abcdef123456", "x1"));
  });
});

const maskedDocument = (): DesignDocument => {
  const base = documentWith("a");
  const [layer] = base.pages[0]?.elements ?? [];
  if (layer === undefined) return base;
  const mask = { mediaVersionId: null, enabled: true, linked: true };
  return { ...base, pages: [{ ...PAGE, elements: [{ ...layer, mask }] }] };
};

describe("layer mask pixels", () => {
  it("lists the mask beside its layer and keeps dirty mask keys", () => {
    const keys = pixelRefsOf(maskedDocument()).map((ref) => [ref.key, ref.mask]);
    expect(keys).toEqual([
      ["a", false],
      ["a:mask", true],
    ]);
    expect(pendingPixelIds(maskedDocument(), ["a:mask", "gone:mask"])).toEqual(["a:mask"]);
  });

  it("retargets only the mask version for a mask key", () => {
    const next = withPixelsVersion(maskedDocument(), "a:mask", VERSION);
    const layer = next.pages[0]?.elements[0];
    expect(layer?.mask?.mediaVersionId).toBe(VERSION);
    expect(layer?.kind === "raster" ? layer.pixelsVersionId : "x").toBeNull();
    expect(withPixelsVersion(next, "a:mask", VERSION)).toBe(next);
  });

  it("names mask files apart from layer files", () => {
    expect(pixelFileName("abcdef123456:mask", "x1")).toBe("mascara-abcdef12-x1.png");
  });

  it("collects mask versions for signed urls", () => {
    const next = withPixelsVersion(maskedDocument(), "a:mask", VERSION);
    expect(rasterPixelsIds(next)).toEqual([VERSION]);
  });
});
