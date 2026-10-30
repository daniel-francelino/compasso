import { useContext, useState } from "react";
import { ContentEditorPage } from "@/components/marketing/content/content-editor-page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { GuardContext } from "@/hooks/shared/use-unsaved-changes";
import { cn } from "@/lib/shared/utils";

export type ContentModalTarget =
  | { kind: "item"; itemId: string }
  | { kind: "new"; day: string | undefined; brandId: string | undefined };

export function ContentModal({
  target,
  onClose,
}: {
  target: ContentModalTarget | null;
  onClose: () => void;
}) {
  const guard = useContext(GuardContext);
  const [expanded, setExpanded] = useState(false);
  const isItem = target?.kind === "item";

  function close() {
    setExpanded(false);
    onClose();
  }

  async function requestClose() {
    if (guard?.hasUnsaved && !(await guard.confirmDiscard())) return;
    close();
  }

  const chrome = {
    expanded,
    onToggleExpand: () => setExpanded(!expanded),
    onClose: () => void requestClose(),
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent
        hideClose
        className={cn(
          "!flex !flex-col !gap-0 !overflow-y-auto !p-0",
          expanded
            ? "!fixed !inset-0 !left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none"
            : "!h-[88dvh] !max-h-[88dvh] !w-[calc(100%-2rem)] !max-w-5xl",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isItem ? "Conteúdo" : "Novo conteúdo"}</DialogTitle>
          <DialogDescription>
            {isItem
              ? "Veja e edite o conteúdo sem sair da tela."
              : "Crie o conteúdo sem sair da tela."}
          </DialogDescription>
        </DialogHeader>
        {target?.kind === "item" ? (
          <ContentEditorPage itemId={target.itemId} onSaved={() => undefined} modal={chrome} />
        ) : null}
        {target?.kind === "new" ? (
          <ContentEditorPage
            brandId={target.brandId}
            day={target.day}
            onSaved={close}
            modal={chrome}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
