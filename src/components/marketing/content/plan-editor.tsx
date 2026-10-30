import {
  type EditorAllow,
  type EditorBubbleTool,
  type EditorImageAttrs,
  EditorBlock,
  RichTextEditor,
} from "lost-ui/editor";
import { useMemo } from "react";
import { toast } from "sonner";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { newItem, rejectionFor, sendUpload } from "@/hooks/shared/use-media-upload";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind, kindOfMime, mimeOfFile } from "@/lib/shared/media/limits";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { unwrapResult } from "@/lib/shared/result-client";
import { fromEditorJson, missingImageSrc, toEditorJson } from "@/lib/shared/rich-text/editor-doc";
import { RICH_TEXT_MAX_IMAGES } from "@/lib/shared/rich-text/types";

const PLAN_BLOCKS = [
  EditorBlock.Paragraph,
  EditorBlock.Heading2,
  EditorBlock.Heading3,
  EditorBlock.BulletList,
  EditorBlock.OrderedList,
  EditorBlock.Image,
];

const PLAN_ALLOW: EditorAllow = {
  nodes: ["heading", "bulletList", "orderedList", "image"],
  marks: ["bold", "italic"],
};

const REFERENCE_ATTRIBUTES = ["mediaVersionId"];

const BUBBLE_TOOLS: EditorBubbleTool[] = ["bold", "italic"];

const BUBBLE_MENU = { tools: BUBBLE_TOOLS };

const PLACEHOLDER =
  "Organize aqui as informações do jeito que preferir: o tema, a mensagem, a direção do texto e o que mais ajudar quem vai produzir. Digite “/” para títulos, listas e imagens de referência.";

const failureText = (error: unknown): string =>
  error instanceof Error ? error.message : "Não foi possível enviar a imagem. Tente de novo.";

async function resolveImageSrc(attrs: EditorImageAttrs): Promise<string> {
  const id = typeof attrs["mediaVersionId"] === "string" ? attrs["mediaVersionId"] : "";
  if (id === "") return missingImageSrc(id);
  try {
    const signed = unwrapResult(
      await signMediaUrls({ data: { versionIds: [id], variant: MediaVariant.Display } }),
    ).urls;
    return signed[id] ?? missingImageSrc(id);
  } catch {
    return missingImageSrc(id);
  }
}

export function PlanEditor({
  draft,
  brandId,
  disabled,
  error,
}: {
  draft: ContentDraft;
  brandId: string;
  disabled: boolean;
  error: string | undefined;
}) {
  const initial = useMemo(
    () => toEditorJson(draft.values.planSummary),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the editor reads its first value once; later changes come from the editor itself
    [],
  );

  async function uploadImage(file: File) {
    if (brandId === "") throw new Error("Escolha a marca antes de enviar imagens.");
    if (kindOfMime(mimeOfFile(file)) !== MediaKind.Image) {
      throw new Error("No planejamento só é possível enviar imagens.");
    }
    const rejected = rejectionFor(file);
    if (rejected !== null) throw new Error(rejected);
    const outcome = await sendUpload(newItem(file), { scope: MediaScope.Brand, brandId });
    if (!outcome.ok) throw new Error(outcome.message);
    return { src: outcome.versionId, attrs: { mediaVersionId: outcome.versionId } };
  }

  return (
    <div className="space-y-1.5">
      <RichTextEditor<"json">
        format="json"
        defaultValue={initial}
        onValueChange={(json) => draft.set("planSummary", fromEditorJson(json))}
        editable={!disabled}
        surface="plain"
        minHeight="18rem"
        placeholder={PLACEHOLDER}
        blocks={PLAN_BLOCKS}
        allow={PLAN_ALLOW}
        bubbleMenu={BUBBLE_MENU}
        referenceAttributes={REFERENCE_ATTRIBUTES}
        resolveImageSrc={resolveImageSrc}
        onUploadImage={uploadImage}
        onUploadError={(uploadError) => toast.error(failureText(uploadError))}
        maxImages={RICH_TEXT_MAX_IMAGES}
        onMaxImages={(max) => toast.error(`No máximo ${max} imagens no planejamento.`)}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
