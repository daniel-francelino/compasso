import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { DESIGN_PANEL_LABEL, DesignPanel, DesignTool, LayerMove } from "@/lib/shared/design/types";

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
  onAddLayer: (tool: DesignTool) => void;
  onAddRaster: () => void;
  onPanel: (panel: DesignPanel) => void;
  onShortcuts: () => void;
};

const NO_SELECTION = "Selecione um elemento.";

const fileMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "file",
  label: "Arquivo",
  items: [
    ...(c.canEdit
      ? [{ id: "save-version", label: "Salvar versão", onSelect: c.onSaveVersion }]
      : []),
    { id: "versions", label: "Versões", onSelect: c.onVersions },
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

const helpMenu = (c: DesignMenuContext): DesignMenu => ({
  id: "help",
  label: "Ajuda",
  items: [{ id: "shortcuts", label: "Atalhos", onSelect: c.onShortcuts }],
});

export const designMenus = (context: DesignMenuContext): DesignMenu[] => [
  fileMenu(context),
  ...(context.canEdit ? [editMenu(context)] : []),
  viewMenu(context),
  ...(context.canEdit ? [layerMenu(context)] : []),
  helpMenu(context),
];
