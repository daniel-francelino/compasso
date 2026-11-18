import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { ClipboardController } from "@/hooks/shared/design/use-design-clipboard";
import type { DesignImporter } from "@/hooks/shared/design/use-design-import";
import type { MaskController } from "@/hooks/shared/design/use-design-mask";
import {
  LAYER_MASK_KIND_LABEL,
  LayerMaskKind,
  MASK_DELETE_LABEL,
  MASK_DISABLE_LABEL,
  MASK_ENABLE_LABEL,
} from "@/lib/shared/design/layer-mask";
import { DESIGN_IMPORT_LABEL } from "@/lib/shared/design/import/messages";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import { CLIP_DISABLED_REASON, canClipToBelow } from "@/lib/shared/design/adjustment-layers";
import { DESIGN_FILTER_LABEL, DesignFilter } from "@/lib/shared/design/raster/filter-types";
import { ADJUSTMENT_TYPE_LABEL, AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import type { ImageElement } from "@/lib/shared/design/schemas";
import { SELECTION_ADJUST_LABEL, SelectionAdjust } from "@/lib/shared/design/selection-state";
import {
  DESIGN_CLIP_SHORTCUT_LABEL,
  DESIGN_PANEL_LABEL,
  DesignElementKind,
  DesignPanel,
  DesignTool,
  LayerMove,
} from "@/lib/shared/design/types";

export type DesignMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  disabledReason?: string | undefined;
  separatorBefore?: boolean;
  onSelect: () => void;
};

export type DesignMenu = { id: string; label: string; items: DesignMenuItem[] };

export type DesignMenuContext = {
  editor: DesignEditor;
  viewport: DesignViewport;
  canEdit: boolean;
  canExport: boolean;
  full: string | undefined;
  rulers: boolean;
  onRulers: () => void;
  onSaveVersion: () => void;
  onVersions: () => void;
  onExport: () => void;
  importer: DesignImporter;
  onAddLayer: (tool: DesignTool) => void;
  onAddRaster: () => void;
  onAddAdjustment: (type: AdjustmentType) => void;
  onRasterize: (element: ImageElement) => void;
  onPanel: (panel: DesignPanel) => void;
  onShortcuts: () => void;
  selection: SelectionController;
  onAdjust: (kind: SelectionAdjust) => void;
  clipboard: ClipboardController;
  onTransform: () => void;
  masks: MaskController;
  onFilter: (filter: DesignFilter) => void;
  filterReason: string | undefined;
};

const NO_SELECTION = "Selecione um elemento.";
const TRANSFORM_REASON = "Selecione uma camada de pixels visível e desbloqueada.";

const transformReason = ({ editor }: DesignMenuContext): string | undefined => {
  const layer = editor.single;
  const usable = layer?.kind === DesignElementKind.Raster && !layer.locked && !layer.hidden;
  return usable ? undefined : TRANSFORM_REASON;
};

const fileMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "file",
  label: "Arquivo",
  items: [
    ...(c.canEdit
      ? [{ id: "save-version", label: "Salvar versão", onSelect: c.onSaveVersion }]
      : []),
    { id: "versions", label: "Versões", onSelect: c.onVersions },
    ...(c.canEdit
      ? [
          {
            id: "import-file",
            label: DESIGN_IMPORT_LABEL,
            separatorBefore: true,
            disabledReason: c.importer.busy ? "Importando…" : c.importer.reason,
            onSelect: c.importer.open,
          },
        ]
      : []),
    ...(c.canEdit && c.canExport
      ? [{ id: "export", label: "Exportar", separatorBefore: true, onSelect: c.onExport }]
      : []),
  ],
});

const editMenu = (c: DesignMenuContext): DesignMenu => {
  const { editor } = c;
  const none = editor.selectedIds.length === 0 ? NO_SELECTION : undefined;
  return {
    id: "edit",
    label: "Editar",
    items: [
      {
        id: "undo",
        label: "Desfazer",
        shortcut: "Ctrl+Z",
        disabledReason: editor.canUndo ? undefined : "Nada para desfazer.",
        onSelect: editor.undo,
      },
      {
        id: "redo",
        label: "Refazer",
        shortcut: "Ctrl+Shift+Z",
        disabledReason: editor.canRedo ? undefined : "Nada para refazer.",
        onSelect: editor.redo,
      },
      {
        id: "copy",
        label: "Copiar",
        shortcut: "Ctrl+C",
        separatorBefore: true,
        disabledReason: c.clipboard.copyReason,
        onSelect: c.clipboard.copy,
      },
      {
        id: "cut",
        label: "Recortar",
        shortcut: "Ctrl+X",
        disabledReason: c.clipboard.cutReason,
        onSelect: c.clipboard.cut,
      },
      {
        id: "paste",
        label: "Colar",
        shortcut: "Ctrl+V",
        disabledReason: c.clipboard.pasteReason,
        onSelect: () => c.clipboard.paste(false),
      },
      {
        id: "paste-in-place",
        label: "Colar no lugar",
        shortcut: "Ctrl+Shift+V",
        disabledReason: c.clipboard.pasteReason,
        onSelect: () => c.clipboard.paste(true),
      },
      {
        id: "free-transform",
        label: "Transformação livre",
        shortcut: "Ctrl+T",
        disabledReason: transformReason(c),
        onSelect: c.onTransform,
      },
      {
        id: "duplicate",
        label: "Duplicar",
        shortcut: "Ctrl+D",
        separatorBefore: true,
        disabledReason: none ?? (editor.canAdd(editor.selectedIds.length) ? undefined : c.full),
        onSelect: () => editor.duplicate(editor.selectedIds),
      },
      {
        id: "delete",
        label: "Excluir",
        shortcut: "Delete",
        disabledReason: none,
        onSelect: () => editor.remove(editor.selectedIds),
      },
      {
        id: "select-all",
        label: "Selecionar tudo",
        shortcut: "Ctrl+A",
        separatorBefore: true,
        onSelect: editor.selectAll,
      },
    ],
  };
};

const viewMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "view",
  label: "Exibir",
  items: [
    {
      id: "zoom-in",
      label: "Aumentar zoom",
      shortcut: "Ctrl+=",
      onSelect: () => c.viewport.step(1),
    },
    {
      id: "zoom-out",
      label: "Diminuir zoom",
      shortcut: "Ctrl+-",
      onSelect: () => c.viewport.step(-1),
    },
    { id: "fit", label: "Ajustar à tela", shortcut: "Ctrl+0", onSelect: c.viewport.fit },
    { id: "actual", label: "100%", shortcut: "Ctrl+1", onSelect: c.viewport.actualSize },
    {
      id: "rulers",
      label: c.rulers ? "Ocultar réguas" : "Mostrar réguas",
      separatorBefore: true,
      onSelect: c.onRulers,
    },
    ...Object.values(DesignPanel).map((panel, index) => ({
      id: `panel-${panel}`,
      label: `Painel: ${DESIGN_PANEL_LABEL[panel]}`,
      separatorBefore: index === 0,
      onSelect: () => c.onPanel(panel),
    })),
  ],
});

const layerMenu = (c: DesignMenuContext): DesignMenu => {
  const { editor } = c;
  const ids = editor.selectedIds;
  const none = ids.length === 0 ? NO_SELECTION : undefined;
  const single = editor.single;
  const one = single === undefined ? "Selecione um único elemento." : undefined;
  const locked = editor.selected.length > 0 && editor.selected.every((item) => item.locked);
  const hidden = editor.selected.length > 0 && editor.selected.every((item) => item.hidden);
  const grouped = editor.selected.some((item) => item.groupId !== null);
  const order = (id: string, label: string, move: LayerMove) => ({
    id,
    label,
    disabledReason: one,
    onSelect: () => single && editor.move(single.id, move),
  });
  return {
    id: "layer",
    label: "Camada",
    items: [
      {
        id: "new-text",
        label: "Nova camada de texto",
        disabledReason: c.full,
        onSelect: () => c.onAddLayer(DesignTool.Text),
      },
      {
        id: "new-shape",
        label: "Nova camada de forma",
        disabledReason: c.full,
        onSelect: () => c.onAddLayer(DesignTool.Rect),
      },
      {
        id: "new-raster",
        label: "Nova camada",
        disabledReason: c.full,
        onSelect: c.onAddRaster,
      },
      {
        id: "layer-via-copy",
        label: "Camada via cópia",
        shortcut: "Ctrl+J",
        disabledReason: c.clipboard.cutReason,
        onSelect: c.clipboard.layerViaCopy,
      },
      {
        id: "layer-via-cut",
        label: "Camada via recorte",
        shortcut: "Ctrl+Shift+J",
        disabledReason: c.clipboard.cutReason,
        onSelect: c.clipboard.layerViaCut,
      },
      {
        id: "rasterize",
        label: "Rasterizar imagem",
        disabledReason:
          single?.kind === DesignElementKind.Image ? undefined : "Selecione uma imagem.",
        onSelect: () => {
          if (single?.kind === DesignElementKind.Image) c.onRasterize(single);
        },
      },
      {
        id: "clip",
        label: single?.clipToBelow ? "Liberar máscara de corte" : "Criar máscara de corte",
        shortcut: DESIGN_CLIP_SHORTCUT_LABEL,
        disabledReason:
          single !== undefined && canClipToBelow(editor.page, single.id)
            ? undefined
            : CLIP_DISABLED_REASON,
        onSelect: editor.toggleClip,
      },
      ...Object.values(LayerMaskKind).map((kind, index) => ({
        id: `mask-${kind}`,
        label: LAYER_MASK_KIND_LABEL[kind],
        separatorBefore: index === 0,
        disabledReason: c.masks.createReason(kind),
        onSelect: () => c.masks.create(kind),
      })),
      {
        id: "mask-toggle",
        label: single?.mask?.enabled === false ? MASK_ENABLE_LABEL : MASK_DISABLE_LABEL,
        disabledReason: c.masks.deleteReason,
        onSelect: () => single && c.masks.toggleEnabled(single.id),
      },
      {
        id: "mask-delete",
        label: MASK_DELETE_LABEL,
        disabledReason: c.masks.deleteReason,
        onSelect: () => single && c.masks.remove(single.id),
      },
      {
        id: "group",
        label: "Agrupar",
        shortcut: "Ctrl+G",
        separatorBefore: true,
        disabledReason: ids.length < 2 ? "Selecione dois ou mais elementos." : undefined,
        onSelect: editor.group,
      },
      {
        id: "ungroup",
        label: "Desagrupar",
        shortcut: "Ctrl+Shift+G",
        disabledReason: grouped ? undefined : "Selecione um grupo.",
        onSelect: editor.ungroup,
      },
      {
        id: "lock",
        label: locked ? "Desbloquear" : "Bloquear",
        separatorBefore: true,
        disabledReason: none,
        onSelect: () => editor.patchMany(ids.map((id) => ({ id, patch: { locked: !locked } }))),
      },
      {
        id: "hide",
        label: hidden ? "Mostrar camada" : "Ocultar camada",
        disabledReason: none,
        onSelect: () => editor.patchMany(ids.map((id) => ({ id, patch: { hidden: !hidden } }))),
      },
      { ...order("front", "Trazer para a frente", LayerMove.Top), separatorBefore: true },
      order("forward", "Avançar", LayerMove.Up),
      order("backward", "Recuar", LayerMove.Down),
      order("back", "Enviar para trás de tudo", LayerMove.Bottom),
    ],
  };
};

const NO_PIXEL_SELECTION = "Não há seleção de pixels.";

const selectMenu = (c: DesignMenuContext): DesignMenu => {
  const { selection } = c;
  const none = selection.mask === null ? NO_PIXEL_SELECTION : undefined;
  const adjust = (kind: SelectionAdjust, id: string) => ({
    id,
    label: `${SELECTION_ADJUST_LABEL[kind]}…`,
    disabledReason: none,
    onSelect: () => c.onAdjust(kind),
  });
  return {
    id: "select",
    label: "Selecionar",
    items: [
      { id: "select-pixels-all", label: "Todos", onSelect: selection.selectAll },
      {
        id: "deselect",
        label: "Desmarcar",
        shortcut: "Ctrl+D",
        disabledReason: none,
        onSelect: selection.deselect,
      },
      {
        id: "invert",
        label: "Inverter",
        shortcut: "Ctrl+Shift+I",
        disabledReason: none,
        onSelect: selection.invert,
      },
      { ...adjust(SelectionAdjust.Feather, "feather"), separatorBefore: true },
      adjust(SelectionAdjust.Expand, "expand"),
      adjust(SelectionAdjust.Contract, "contract"),
    ],
  };
};

const adjustmentsMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "adjustments",
  label: "Ajustes",
  items: Object.values(AdjustmentType).map((type) => ({
    id: `adjustment-${type}`,
    label: `${ADJUSTMENT_TYPE_LABEL[type]}…`,
    disabledReason: c.full,
    onSelect: () => c.onAddAdjustment(type),
  })),
});

const filterMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "filter",
  label: "Filtro",
  items: Object.values(DesignFilter).map((filter) => ({
    id: `filter-${filter}`,
    label: `${DESIGN_FILTER_LABEL[filter]}…`,
    disabledReason: c.filterReason,
    onSelect: () => c.onFilter(filter),
  })),
});

const helpMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "help",
  label: "Ajuda",
  items: [{ id: "shortcuts", label: "Atalhos", onSelect: c.onShortcuts }],
});

export const designMenus = (context: DesignMenuContext): DesignMenu[] => [
  fileMenu(context),
  ...(context.canEdit ? [editMenu(context), selectMenu(context)] : []),
  viewMenu(context),
  ...(context.canEdit ? [layerMenu(context), adjustmentsMenu(context), filterMenu(context)] : []),
  helpMenu(context),
];
