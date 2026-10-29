import type { Editor } from "@tiptap/core";
import { Bold, Italic } from "lucide-react";
import { EditorBlock, RichTextEditor } from "lost-ui/editor";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { newItem, rejectionFor, sendUpload } from "@/hooks/shared/use-media-upload";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind, kindOfMime, mimeOfFile } from "@/lib/shared/media/limits";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { unwrapResult } from "@/lib/shared/result-client";
import {
  type ImageRegistry,
  fromEditorJson,
  toEditorJson,
} from "@/lib/shared/rich-text/editor-doc";
import { RICH_TEXT_MAX_IMAGES, richDocImages } from "@/lib/shared/rich-text/types";

const PLAN_BLOCKS = [
  EditorBlock.Paragraph,
  EditorBlock.Heading2,
  EditorBlock.Heading3,
  EditorBlock.BulletList,
  EditorBlock.OrderedList,
  EditorBlock.Image,
];

const PLACEHOLDER =
  "Organize aqui as informações do jeito que preferir: o tema, a mensagem, a direção do texto e o que mais ajudar quem vai produzir. Digite “/” para títulos, listas e imagens de referência.";

function BubbleTools({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md">
      <IconButton
        label="Negrito"
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <IconButton
        label="Itálico"
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
    </div>
  );
}

const failureText = (error: unknown): string =>
  error instanceof Error ? error.message : "Não foi possível enviar a imagem. Tente de novo.";

function PlanEditorBody({
  draft,
  brandId,
  disabled,
  urls,
}: {
  draft: ContentDraft;
  brandId: string;
  disabled: boolean;
  urls: Record<string, string> | undefined;
}) {
  const registry = useRef<ImageRegistry>(new Map());
  const initial = useMemo(
    () => toEditorJson(draft.values.planSummary, (id) => urls?.[id], registry.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the editor reads its first value once; later changes come from the editor itself
    [],
  );
  const imageCount = richDocImages(draft.values.planSummary).length;

  async function uploadImage(file: File): Promise<string> {
    if (brandId === "") throw new Error("Escolha a marca antes de enviar imagens.");
    if (imageCount >= RICH_TEXT_MAX_IMAGES) {
      throw new Error(`No máximo ${RICH_TEXT_MAX_IMAGES} imagens no planejamento.`);
    }
    if (kindOfMime(mimeOfFile(file)) !== MediaKind.Image) {
      throw new Error("No planejamento só é possível enviar imagens.");
    }
    const rejected = rejectionFor(file);
    if (rejected !== null) throw new Error(rejected);
    const outcome = await sendUpload(newItem(file), { scope: MediaScope.Brand, brandId });
    if (!outcome.ok) throw new Error(outcome.message);
    const signed = unwrapResult(
      await signMediaUrls({
        data: { versionIds: [outcome.versionId], variant: MediaVariant.Display },
      }),
    ).urls;
    const url = signed[outcome.versionId];
    if (url === undefined) throw new Error("Não foi possível mostrar a imagem agora.");
    registry.current.set(url, outcome.versionId);
    return url;
  }

  return (
    <RichTextEditor<"json">
      format="json"
      defaultValue={initial}
      onValueChange={(json) => draft.set("planSummary", fromEditorJson(json, registry.current))}
      editable={!disabled}
      surface="plain"
      minHeight="18rem"
      placeholder={PLACEHOLDER}
      blocks={PLAN_BLOCKS}
      renderBubbleMenu={(editor) => <BubbleTools editor={editor} />}
      onUploadImage={uploadImage}
      onUploadError={(error) => toast.error(failureText(error))}
    />
  );
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
  const firstIds = useRef(
    richDocImages(draft.values.planSummary).map((image) => image.mediaVersionId),
  );
  const signed = useSignedUrls(firstIds.current, MediaVariant.Display);
  const ready = firstIds.current.length === 0 || !signed.isPending;
  return (
    <div className="space-y-1.5">
      {ready ? (
        <PlanEditorBody draft={draft} brandId={brandId} disabled={disabled} urls={signed.data} />
      ) : (
        <Skeleton className="h-72 w-full" />
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
