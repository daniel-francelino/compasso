import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, History, PanelRight, Redo2, Save, Undo2 } from "lucide-react";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { IconButton } from "@/components/shared/admin/icon-button";
import { DesignNameField } from "@/components/shared/design/design-name-field";
import { DesignSaveStatus } from "@/components/shared/design/design-save-status";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignSaveState } from "@/lib/shared/design/types";
import { AppRoute } from "@/lib/shared/routes";

export function DesignTopBar({
  editor,
  name,
  meta,
  editable,
  canEdit,
  canExport,
  isTemplate,
  saveState,
  savingVersion,
  showSaveState,
  onRename,
  onTemplate,
  onVersions,
  onSaveVersion,
  onExport,
  onPanels,
}: {
  editor: DesignEditor;
  name: string;
  meta: string;
  editable: boolean;
  canEdit: boolean;
  canExport: boolean;
  isTemplate: boolean;
  saveState: DesignSaveState;
  savingVersion: boolean;
  showSaveState: boolean;
  onRename: (name: string) => Promise<boolean>;
  onTemplate: (template: boolean) => void;
  onVersions: () => void;
  onSaveVersion: () => void;
  onExport: () => void;
  onPanels: () => void;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
      <Button asChild variant="ghost" size="icon" aria-label="Voltar para designs">
        <Link to={AppRoute.Designs}>
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-40 max-w-sm flex-1">
          <DesignNameField name={name} disabled={!canEdit} onRename={onRename} />
        </div>
        <span className="hidden truncate text-sm text-muted-foreground lg:inline">{meta}</span>
      </div>
      {editable ? (
        <div className="hidden md:block">
          <FormSwitch
            name="isTemplate"
            label="Modelo da marca"
            value={isTemplate}
            disabled={!canEdit}
            onValueChange={onTemplate}
          />
        </div>
      ) : null}
      {showSaveState ? <DesignSaveStatus state={saveState} /> : null}
      {canEdit ? (
        <div className="flex items-center">
          <IconButton
            label="Desfazer (Ctrl+Z)"
            icon={Undo2}
            disabled={!editor.canUndo}
            onClick={editor.undo}
          />
          <IconButton
            label="Refazer (Ctrl+Shift+Z)"
            icon={Redo2}
            disabled={!editor.canRedo}
            onClick={editor.redo}
          />
        </div>
      ) : null}
      <div className="xl:hidden">
        <IconButton label="Painéis" icon={PanelRight} onClick={onPanels} />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onVersions}>
        <History aria-hidden="true" />
        Versões
      </Button>
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={savingVersion}
          onClick={onSaveVersion}
        >
          <Save aria-hidden="true" />
          Salvar versão
        </Button>
      ) : null}
      {canEdit && canExport ? (
        <Button type="button" size="sm" onClick={onExport}>
          <Download aria-hidden="true" />
          Exportar
        </Button>
      ) : null}
    </header>
  );
}
