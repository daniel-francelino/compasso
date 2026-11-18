import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FolderClosed,
  Image,
  Layers,
  Lock,
  LockOpen,
  type LucideIcon,
  Minus,
  Pencil,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "lost-ui/ui/context-menu";
import { checkerboard } from "@/components/shared/design/checkerboard";
import { DesignBlendControls } from "@/components/shared/design/design-blend-controls";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { layerLabel } from "@/lib/shared/design/layers";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignElementKind, LayerMove } from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const KIND_ICON: Record<DesignElementKind, LucideIcon> = {
  [DesignElementKind.Text]: Type,
  [DesignElementKind.Image]: Image,
  [DesignElementKind.Rect]: Square,
  [DesignElementKind.Ellipse]: Circle,
  [DesignElementKind.Line]: Minus,
  [DesignElementKind.Raster]: Layers,
  [DesignElementKind.Adjustment]: SlidersHorizontal,
  [DesignElementKind.Group]: FolderClosed,
};

const THUMB = checkerboard(8);

export type DropMark = "before" | "after" | null;

type Props = {
  editor: DesignEditor;
  element: DesignElement;
  selected: boolean;
  editable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  renaming: boolean;
  dropMark: DropMark;
  onRenameStart: () => void;
  onRenameEnd: () => void;
  onMove: (move: LayerMove) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
};

function LayerToggle({
  pressed,
  label,
  icon: Icon,
  onClick,
}: {
  pressed: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

function RenameField({
  element,
  onCommit,
  onCancel,
}: {
  element: DesignElement;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(element.name === "" ? layerLabel(element) : element.name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  const finish = (action: () => void) => {
    if (done.current) return;
    done.current = true;
    action();
  };

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      aria-label="Renomear camada"
      value={value}
      maxLength={DESIGN_LIMITS.layerNameMax}
      className="h-9 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(() => onCommit(value))}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(() => onCommit(value));
        if (event.key === "Escape") finish(onCancel);
      }}
    />
  );
}

export function DesignLayerRow(props: Props) {
  const { editor, element, selected, editable, renaming, dropMark } = props;
  const KindIcon = KIND_ICON[element.kind];
  const label = layerLabel(element);

  const commitName = (name: string) => {
    props.onRenameEnd();
    const next = name.trim();
    if (next !== element.name.trim()) editor.patch(element.id, { name: next });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editable) return;
    if (event.key === "F2") {
      event.preventDefault();
      props.onRenameStart();
      return;
    }
    if (!event.altKey) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      props.onMove(LayerMove.Up);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      props.onMove(LayerMove.Down);
    }
  };

  const toggleHidden = () => editor.patch(element.id, { hidden: !element.hidden });
  const toggleLocked = () => editor.patch(element.id, { locked: !element.locked });

  const body = (
    <li
      draggable={editable && !renaming}
      className="relative list-none"
      onContextMenu={() => {
        if (!selected) editor.select(element.id);
      }}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
    >
      {dropMark === "before" ? (
        <span aria-hidden="true" className="absolute inset-x-1 -top-px z-10 h-0.5 bg-primary" />
      ) : null}
      <div
        className={cn(
          "flex items-center gap-1 rounded-md border px-1",
          selected ? "border-primary bg-accent" : "border-transparent",
        )}
      >
        {editable ? (
          <LayerToggle
            pressed={!element.hidden}
            label="Visível"
            icon={element.hidden ? EyeOff : Eye}
            onClick={toggleHidden}
          />
        ) : null}
        <span
          aria-hidden="true"
          style={THUMB}
          className="flex size-8 shrink-0 items-center justify-center rounded border"
        >
          <KindIcon className="size-4 text-foreground" />
        </span>
        {renaming ? (
          <RenameField element={element} onCommit={commitName} onCancel={props.onRenameEnd} />
        ) : (
          <button
            type="button"
            aria-pressed={selected}
            className="min-h-11 min-w-0 flex-1 truncate rounded px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => editor.select(element.id, event.shiftKey)}
            onDoubleClick={() => {
              if (editable) props.onRenameStart();
            }}
            onKeyDown={onKeyDown}
          >
            {label}
            {element.groupId === null ? null : (
              <span className="ml-1 text-xs text-muted-foreground">(grupo)</span>
            )}
            {element.hidden && !editable ? <span className="sr-only"> (oculta)</span> : null}
            {element.locked && !editable ? <span className="sr-only"> (bloqueada)</span> : null}
          </button>
        )}
        {editable ? (
          <LayerToggle
            pressed={element.locked}
            label="Bloqueada"
            icon={element.locked ? Lock : LockOpen}
            onClick={toggleLocked}
          />
        ) : null}
      </div>
      {selected && editor.single?.id === element.id ? (
        <div className="px-2 pb-2 pt-1">
          <DesignBlendControls
            editor={editor}
            element={element}
            disabled={!editable || element.locked}
            showFill={false}
            idPrefix="layer-"
          />
        </div>
      ) : null}
      {dropMark === "after" ? (
        <span aria-hidden="true" className="absolute inset-x-1 -bottom-px z-10 h-0.5 bg-primary" />
      ) : null}
    </li>
  );

  if (!editable) return body;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{body}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          disabled={!editor.canAdd()}
          onSelect={() => editor.duplicate([element.id])}
        >
          <Copy aria-hidden="true" />
          Duplicar
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={props.onRenameStart}>
          <Pencil aria-hidden="true" />
          Renomear camada
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={toggleLocked}>
          {element.locked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {element.locked ? "Desbloquear" : "Bloquear"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={toggleHidden}>
          {element.hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {element.hidden ? "Mostrar camada" : "Ocultar camada"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!props.canMoveUp} onSelect={() => props.onMove(LayerMove.Up)}>
          <ArrowUp aria-hidden="true" />
          Trazer para frente
          <ContextMenuShortcut>Alt+↑</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!props.canMoveDown}
          onSelect={() => props.onMove(LayerMove.Down)}
        >
          <ArrowDown aria-hidden="true" />
          Enviar para trás
          <ContextMenuShortcut>Alt+↓</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => editor.remove([element.id])}
        >
          <Trash2 aria-hidden="true" />
          Excluir
          <ContextMenuShortcut>Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
