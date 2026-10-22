import { describe, expect, it } from "vitest";
import {
  RICH_TEXT_MAX_CHARACTERS,
  RichNodeType,
  richDocFromPlain,
  richDocFromStored,
  richDocSchema,
} from "@/lib/shared/rich-text/types";

const paragraph = (text: string) => ({
  type: RichNodeType.Paragraph,
  content: [{ type: RichNodeType.Text, text }],
});

describe("rich text", () => {
  it("accepts the closed set of nodes and marks", () => {
    const doc = {
      type: RichNodeType.Doc,
      content: [
        {
          type: RichNodeType.Paragraph,
          content: [{ type: RichNodeType.Text, text: "Oi", marks: [{ type: "bold" }] }],
        },
      ],
    };
    expect(richDocSchema.safeParse(doc).success).toBe(true);
  });

  it("refuses links, unknown nodes and extra attributes", () => {
    const link = {
      type: RichNodeType.Doc,
      content: [
        {
          type: RichNodeType.Paragraph,
          content: [
            {
              type: RichNodeType.Text,
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };
    expect(richDocSchema.safeParse(link).success).toBe(false);
    expect(
      richDocSchema.safeParse({ type: RichNodeType.Doc, content: [{ type: "image" }] }).success,
    ).toBe(false);
  });

  it("refuses a text longer than the limit", () => {
    const doc = {
      type: RichNodeType.Doc,
      content: [paragraph("a".repeat(RICH_TEXT_MAX_CHARACTERS + 1))],
    };
    expect(richDocSchema.safeParse(doc).success).toBe(false);
  });

  it("reads the earlier plain format and treats empty text as no briefing", () => {
    expect(richDocFromStored({ text: "Primeira\n\nSegunda" })?.content).toHaveLength(2);
    expect(richDocFromStored({ text: "  " })).toBeNull();
    expect(richDocFromStored(null)).toBeNull();
    expect(richDocFromPlain("")).toBeNull();
  });

  it("reads a planning summary saved as a plain string", () => {
    expect(richDocFromStored("Tema\n\nMensagem")?.content).toHaveLength(2);
    expect(richDocFromStored("   ")).toBeNull();
  });
});
