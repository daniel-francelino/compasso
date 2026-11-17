import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const FULL_PAGES = `Um design tem no máximo ${DESIGN_LIMITS.maxPages} páginas.`;

export function DesignPagesStrip({
  editor,
  editable,
}: {
  editor: DesignEditor;
  editable: boolean;
}) {
  const pages = editor.document.pages;
  const index = pages.findIndex((page) => page.id === editor.pageId);
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center gap-2">
      <ol className="flex flex-wrap gap-1">
        {pages.map((page, position) => {
          const current = page.id === editor.pageId;
          return (
            <li key={page.id}>
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => editor.goToPage(page.id)}
                className={cn(
                  "min-h-11 min-w-11 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  current ? "border-primary bg-accent font-medium" : "bg-card",
                )}
              >
                <span className="sr-only">Página </span>
                {position + 1}
              </button>
            </li>
          );
        })}
      </ol>
      {editable ? (
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            label="Nova página"
            icon={Plus}
            disabledReason={editor.canAddPage ? undefined : FULL_PAGES}
            onClick={editor.addPage}
          />
          <IconButton
            label="Duplicar página"
            icon={Copy}
            disabledReason={editor.canAddPage ? undefined : FULL_PAGES}
            onClick={editor.duplicatePage}
          />
          <IconButton
            label="Mover página para a esquerda"
            icon={ArrowLeft}
            disabled={index <= 0}
            onClick={() => editor.movePage(-1)}
          />
          <IconButton
            label="Mover página para a direita"
            icon={ArrowRight}
            disabled={index >= pages.length - 1}
            onClick={() => editor.movePage(1)}
          />
          <IconButton
            label="Excluir página"
            icon={Trash2}
            destructive
            disabledReason={
              pages.length <= 1 ? "Um design precisa de ao menos uma página." : undefined
            }
            onClick={editor.removePage}
          />
        </div>
      ) : null}
    </nav>
  );
}
