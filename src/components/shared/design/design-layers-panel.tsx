import { ArrowDown, ArrowUp, Lock, LockOpen, Trash2 } from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { DESIGN_ELEMENT_LABEL, DesignElementKind, LayerMove } from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const SNIPPET = 28;

const layerName = (element: DesignElement): string => {
  const kind = DESIGN_ELEMENT_LABEL[element.kind];
  const detail =
    element.kind === DesignElementKind.Text
      ? element.text.trim().replace(/\s+/g, " ")
      : element.kind === DesignElementKind.Image
        ? element.alt.trim()
        : "";
  if (detail === "") return kind;
  return `${kind}: ${detail.length > SNIPPET ? `${detail.slice(0, SNIPPET)}…` : detail}`;
};

export function DesignLayersPanel({
  editor,
  editable,
}: {
  editor: DesignEditor;
  editable: boolean;
}) {
  const elements = editor.page.elements;
  const ordered = [...elements].reverse();
  const last = elements.length - 1;

  return (
    <section aria-labelledby="design-layers-title" className="space-y-2">
      <h2 id="design-layers-title" className="text-sm font-semibold">
        Camadas
      </h2>
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum elemento nesta página. Use a barra acima para adicionar texto, imagem, forma ou
          linha.
        </p>
      ) : (
        <ol className="space-y-1" aria-label="Camadas da página, da frente para trás">
          {ordered.map((element) => {
            const index = elements.indexOf(element);
            const selected = editor.selectedIds.includes(element.id);
            return (
              <li
                key={element.id}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-1",
                  selected ? "border-primary bg-accent" : "border-transparent",
                )}
              >
                <button
                  type="button"
                  className="min-h-11 flex-1 truncate rounded px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-pressed={selected}
                  onClick={(event) => editor.select(element.id, event.shiftKey)}
                >
                  {layerName(element)}
                  {element.groupId === null ? null : (
                    <span className="ml-1 text-xs text-muted-foreground">(grupo)</span>
                  )}
                  {element.locked ? <span className="sr-only"> (bloqueado)</span> : null}
                </button>
                {editable ? (
                  <>
                    <IconButton
                      label={element.locked ? "Desbloquear" : "Bloquear"}
                      icon={element.locked ? Lock : LockOpen}
                      onClick={() => editor.patch(element.id, { locked: !element.locked })}
                    />
                    <IconButton
                      label="Trazer para frente"
                      icon={ArrowUp}
                      disabled={index === last}
                      onClick={() => editor.move(element.id, LayerMove.Up)}
                    />
                    <IconButton
                      label="Enviar para trás"
                      icon={ArrowDown}
                      disabled={index === 0}
                      onClick={() => editor.move(element.id, LayerMove.Down)}
                    />
                    <IconButton
                      label="Excluir"
                      icon={Trash2}
                      destructive
                      onClick={() => editor.remove([element.id])}
                    />
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
