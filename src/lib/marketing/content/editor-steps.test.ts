import { describe, expect, it } from "vitest";
import { EditorStep, initialStep } from "@/lib/marketing/content/editor-steps";

describe("initialStep", () => {
  it("opens on the planning step for an empty content", () => {
    expect(initialStep({ caption: "", files: [], rows: [] })).toBe(EditorStep.Planning);
  });

  it("opens on the content step when there is a base caption", () => {
    expect(initialStep({ caption: "Texto do post", files: [], rows: [] })).toBe(EditorStep.Content);
  });

  it("opens on the content step when there are art files", () => {
    expect(initialStep({ caption: "", files: [{}], rows: [] })).toBe(EditorStep.Content);
  });

  it("opens on the content step when a channel row has its own caption", () => {
    expect(initialStep({ caption: "  ", files: [], rows: [{ caption: "Legenda do canal" }] })).toBe(
      EditorStep.Content,
    );
  });

  it("ignores blank captions", () => {
    expect(initialStep({ caption: " ", files: [], rows: [{ caption: "" }] })).toBe(
      EditorStep.Planning,
    );
  });
});
