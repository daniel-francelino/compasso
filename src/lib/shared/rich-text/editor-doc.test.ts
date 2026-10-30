import { describe, expect, it } from "vitest";
import { fromEditorJson, toEditorJson } from "@/lib/shared/rich-text/editor-doc";
import {
  RICH_TEXT_MAX_IMAGES,
  RichNodeType,
  type RichDoc,
  isRichDocEmpty,
  richDocImages,
  richDocSchema,
} from "@/lib/shared/rich-text/types";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const imageDoc = (ids: string[]): RichDoc => ({
  type: RichNodeType.Doc,
  content: ids.map((id) => ({ type: RichNodeType.Image, attrs: { mediaVersionId: id } })),
});

describe("editor bridge", () => {
  it("turns a stored doc into editor JSON and back without losing the image reference", () => {
    const doc: RichDoc = {
      type: RichNodeType.Doc,
      content: [
        { type: RichNodeType.Paragraph, content: [{ type: RichNodeType.Text, text: "Ideia" }] },
        { type: RichNodeType.Image, attrs: { mediaVersionId: ID_A, alt: "Referência" } },
      ],
    };
    const editor = toEditorJson(doc);
    expect(editor.content?.[1]?.attrs?.["mediaVersionId"]).toBe(ID_A);
    expect(fromEditorJson(editor)).toEqual(doc);
  });

  it("drops an image that carries no media reference", () => {
    const doc = fromEditorJson({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Oi" }] },
        { type: "image", attrs: { src: "https://elsewhere.test/a.png" } },
      ],
    });
    expect(richDocImages(doc)).toEqual([]);
    expect(doc?.content).toHaveLength(1);
  });

  it("keeps only bold and italic and clamps headings", () => {
    const doc = fromEditorJson({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A" }] },
        { type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "B" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "C",
              marks: [
                { type: "bold" },
                { type: "underline" },
                { type: "link" },
                { type: "italic" },
              ],
            },
          ],
        },
      ],
    });
    expect(doc?.content?.[0]?.attrs?.level).toBe(2);
    expect(doc?.content?.[1]?.attrs?.level).toBe(3);
    expect(doc?.content?.[2]?.content?.[0]?.marks).toEqual([{ type: "bold" }, { type: "italic" }]);
  });

  it("unwraps blocks outside the closed set", () => {
    const doc = fromEditorJson({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Citação" }] }],
        },
        { type: "codeBlock", content: [{ type: "text", text: "let a = 1" }] },
        { type: "horizontalRule" },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Tarefa" }] }],
            },
          ],
        },
      ],
    });
    const types = (doc?.content ?? []).map((node) => node.type);
    expect(types).toEqual(["paragraph", "paragraph", "bulletList"]);
    expect(richDocSchema.safeParse(doc).success).toBe(true);
  });

  it("does not treat an image-only plan as empty", () => {
    expect(isRichDocEmpty(imageDoc([ID_A]))).toBe(false);
    expect(isRichDocEmpty({ type: RichNodeType.Doc, content: [] })).toBe(true);
  });

  it("lists each image once, in reading order", () => {
    expect(
      richDocImages(imageDoc([ID_B, ID_A, ID_B])).map((image) => image.mediaVersionId),
    ).toEqual([ID_B, ID_A]);
  });

  it("refuses more images than the plan allows", () => {
    const ids = Array.from(
      { length: RICH_TEXT_MAX_IMAGES + 1 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    const result = richDocSchema.safeParse(imageDoc(ids));
    expect(result.success).toBe(false);
  });

  it("refuses a doc that would not fit the stored column", () => {
    const long: RichDoc = {
      type: RichNodeType.Doc,
      content: Array.from({ length: 60 }, () => ({
        type: RichNodeType.Paragraph,
        content: [{ type: RichNodeType.Text, text: "x".repeat(70) }],
      })),
    };
    expect(richDocSchema.safeParse(long).success).toBe(false);
  });
});
