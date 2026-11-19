import { describe, expect, it } from "vitest";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { unreferencedRasterIds } from "@/lib/shared/design/raster-references";
import type { DesignDocument } from "@/lib/shared/design/schemas";

const SIZE = { width: 10, height: 10 };

const documentWith = (...ids: string[]): DesignDocument => {
  const page = emptyPage("page-1");
  return {
    version: 4,
    pages: [{ ...page, elements: ids.map((id) => createRasterLayer(id, page, SIZE)) }],
  };
};

describe("unreferencedRasterIds", () => {
  it("keeps ids used by any history document", () => {
    const documents = [documentWith("a"), documentWith("b"), documentWith("c")];
    expect(unreferencedRasterIds(documents, [], ["a", "b", "c", "d"])).toEqual(["d"]);
  });

  it("keeps ids targeted by pixel history steps", () => {
    expect(unreferencedRasterIds([documentWith("a")], ["z"], ["a", "z", "y"])).toEqual(["y"]);
  });

  it("returns nothing when everything is referenced", () => {
    expect(unreferencedRasterIds([documentWith("a")], [], ["a"])).toEqual([]);
  });
});
