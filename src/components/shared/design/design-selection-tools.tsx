import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  BringToFront,
  Copy,
  Group,
  Lock,
  LockOpen,
  type LucideIcon,
  SendToBack,
  Trash2,
  Ungroup,
} from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { alignsToPage, canDistribute } from "@/lib/shared/design/arrange";
import {
  DESIGN_ALIGN_ACTION_LABEL,
  DESIGN_DISTRIBUTE_LABEL,
  DESIGN_ELEMENT_LABEL,
  DesignAlign,
  DesignDistribute,
  LayerMove,
  type PageSize,
} from "@/lib/shared/design/types";

const ALIGN_ICONS: Record<DesignAlign, LucideIcon> = {
  [DesignAlign.Left]: AlignStartVertical,
  [DesignAlign.CenterX]: AlignCenterVertical,
  [DesignAlign.Right]: AlignEndVertical,
  [DesignAlign.Top]: AlignStartHorizontal,
  [DesignAlign.CenterY]: AlignCenterHorizontal,
  [DesignAlign.Bottom]: AlignEndHorizontal,
};

const DISTRIBUTE_ICONS: Record<DesignDistribute, LucideIcon> = {
  [DesignDistribute.Horizontal]: AlignHorizontalSpaceAround,
  [DesignDistribute.Vertical]: AlignVerticalSpaceAround,
};

export const Divider = () => (
  <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
);

export function DesignSelectionTools({ editor, size }: { editor: DesignEditor; size: PageSize }) {
  const ids = editor.selectedIds;
  const page = editor.page;
  const locked = editor.selected.every((element) => element.locked);
  const grouped = editor.selected.some((element) => element.groupId !== null);
  const single = editor.single;
  const toPage = alignsToPage(page, ids);
  const distribute = canDistribute(page, ids);
  const title =
    single === undefined
      ? `${editor.selected.length} elementos`
      : DESIGN_ELEMENT_LABEL[single.kind];
  const lockedReason = locked ? "Desbloqueie para mover." : undefined;

  return (
    <>
      <span className="shrink-0 px-1 text-sm font-medium">{title}</span>
      <Divider />
      {Object.values(DesignAlign).map((align) => (
        <IconButton
          key={align}
          label={`${DESIGN_ALIGN_ACTION_LABEL[align]}${toPage ? " (à página)" : ""}`}
          icon={ALIGN_ICONS[align]}
          disabledReason={lockedReason}
          onClick={() => editor.align(align, size)}
        />
      ))}
      {Object.values(DesignDistribute).map((axis) => (
        <IconButton
          key={axis}
          label={DESIGN_DISTRIBUTE_LABEL[axis]}
          icon={DISTRIBUTE_ICONS[axis]}
          disabledReason={distribute ? undefined : "Selecione três ou mais elementos."}
          onClick={() => editor.distribute(axis)}
        />
      ))}
      <Divider />
      <IconButton
        label="Trazer para a frente"
        icon={BringToFront}
        disabledReason={single === undefined ? "Selecione um elemento." : undefined}
        onClick={() => single && editor.move(single.id, LayerMove.Top)}
      />
      <IconButton
        label="Enviar para trás de tudo"
        icon={SendToBack}
        disabledReason={single === undefined ? "Selecione um elemento." : undefined}
        onClick={() => single && editor.move(single.id, LayerMove.Bottom)}
      />
      <IconButton
        label={grouped ? "Desagrupar (Ctrl+Shift+G)" : "Agrupar (Ctrl+G)"}
        icon={grouped ? Ungroup : Group}
        disabledReason={
          !grouped && ids.length < 2 ? "Selecione dois ou mais elementos." : undefined
        }
        onClick={grouped ? editor.ungroup : editor.group}
      />
      <IconButton
        label={locked ? "Desbloquear" : "Bloquear"}
        icon={locked ? Lock : LockOpen}
        onClick={() => editor.patchMany(ids.map((id) => ({ id, patch: { locked: !locked } })))}
      />
      <IconButton
        label="Duplicar (Ctrl+D)"
        icon={Copy}
        disabledReason={
          editor.canAdd(ids.length) ? undefined : "O design chegou ao limite de elementos."
        }
        onClick={() => editor.duplicate(ids)}
      />
      <IconButton
        label="Excluir (Delete)"
        icon={Trash2}
        destructive
        onClick={() => editor.remove(ids)}
      />
    </>
  );
}
