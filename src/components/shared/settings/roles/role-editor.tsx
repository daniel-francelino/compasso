import { ShieldCheck, CheckCheck, Eraser } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EditorSheet } from "@/components/shared/admin/editor-sheet";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import {
  MODULE_LABELS,
  ACTION_DESCRIPTION_LABELS,
  groupByModule,
  visibleActions,
  withDependencies,
  withoutDependents,
} from "@/lib/shared/auth/role-matrix";
import { type ActionInfo, type RoleRow, saveRole } from "@/lib/shared/auth/roles.functions";
import { saveRoleSchema } from "@/lib/shared/auth/schemas";

export function RoleEditor({
  open,
  role,
  duplicateOf,
  catalog,
  onClose,
  onDirtyChange,
  onSaved,
  restoreFocus,
}: {
  open: boolean;
  role?: RoleRow | undefined;
  duplicateOf?: RoleRow | undefined;
  catalog: ActionInfo[];
  onClose: () => void;
  onDirtyChange: (state: { dirty: boolean; busy: boolean }) => void;
  onSaved: () => void;
  restoreFocus: (event: Event) => void;
}) {
  const source = role ?? duplicateOf;
  const readOnly = role?.isSystem === true;
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(
    role?.name ?? (duplicateOf ? `${duplicateOf.name} (cópia)` : ""),
  );
  const [description, setDescription] = useState(source?.description ?? "");
  const [portalOnly, setPortalOnly] = useState(source?.portalOnly ?? false);
  const [selected, setSelected] = useState<Set<string>>(new Set(source?.actions ?? []));

  const actions = useMemo(() => visibleActions(catalog, portalOnly), [catalog, portalOnly]);
  const groups = useMemo(() => groupByModule(actions), [actions]);

  const dirty =
    name !== (role?.name ?? "") ||
    description !== (role?.description ?? "") ||
    selected.size !== (role?.actions.length ?? 0) ||
    [...selected].some((key) => !role?.actions.includes(key));

  useEffect(() => {
    onDirtyChange({ dirty, busy });
  }, [dirty, busy, onDirtyChange]);

  const toggle = (key: string, checked: boolean) =>
    setSelected((current) =>
      checked
        ? withDependencies(current, catalog, [key])
        : withoutDependents(current, catalog, [key]),
    );

  const setModule = (keys: string[], checked: boolean) =>
    setSelected((current) =>
      checked
        ? withDependencies(current, catalog, keys)
        : withoutDependents(current, catalog, keys),
    );

  const changePortalOnly = (value: boolean) => {
    setPortalOnly(value);
    if (!value) return;
    const allowed = new Set(visibleActions(catalog, true).map((action) => action.key));
    setSelected((current) => new Set([...current].filter((key) => allowed.has(key))));
  };

  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      restoreFocus={restoreFocus}
      title={role ? (readOnly ? role.name : `Editar perfil: ${role.name}`) : "Novo perfil"}
      description={
        readOnly
          ? "Acesso total. Este perfil do sistema não pode ser alterado."
          : "Escolha o que as pessoas com este perfil podem fazer."
      }
      formId="role-form"
      busy={busy}
      saveDisabled={readOnly}
    >
      <form
        id="role-form"
        ref={formRef}
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly) return;
          void submit(
            saveRoleSchema,
            {
              ...(role ? { id: role.id } : {}),
              name,
              description,
              portalOnly,
              actions: [...selected],
            },
            (data) => saveRole({ data }),
            onSaved,
          );
        }}
      >
        <TextField
          id="role-name"
          label="Nome"
          required
          value={name}
          onValueChange={setName}
          maxLength={60}
          disabled={readOnly}
          error={errors["name"]}
        />
        <TextAreaField
          id="role-description"
          label="Descrição"
          value={description}
          onValueChange={setDescription}
          maxLength={300}
          rows={2}
          disabled={readOnly}
        />
        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div>
            <Label htmlFor="role-portal">Perfil do portal do cliente</Label>
            <p className="text-xs text-muted-foreground">
              Só pode ter ações do portal e é usado por pessoas de fora da equipe.
            </p>
          </div>
          <Switch
            id="role-portal"
            checked={portalOnly}
            onCheckedChange={changePortalOnly}
            disabled={readOnly || role !== undefined}
          />
        </div>

        {readOnly ? null : (
          <div className="space-y-4">
            {groups.map((group) => {
              const keys = group.actions.map((action) => action.key);
              return (
                <FieldGroup
                  key={group.module}
                  legend={MODULE_LABELS[group.module] ?? group.module}
                  variant="boxed"
                  gap="sm"
                >
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setModule(keys, true)}
                    >
                      <CheckCheck aria-hidden="true" />
                      Selecionar tudo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setModule(keys, false)}
                    >
                      <Eraser aria-hidden="true" />
                      Limpar
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {group.actions.map((action) => (
                      <li key={action.key} className="flex items-start gap-2 py-1">
                        <Checkbox
                          id={`action-${action.key}`}
                          checked={selected.has(action.key)}
                          onCheckedChange={(checked) => toggle(action.key, checked === true)}
                        />
                        <Label htmlFor={`action-${action.key}`} className="font-normal">
                          {ACTION_DESCRIPTION_LABELS[action.key] ?? action.description}
                        </Label>
                      </li>
                    ))}
                  </ul>
                </FieldGroup>
              );
            })}
          </div>
        )}
        <FormError message={error} />
        {readOnly ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" /> Acesso total
          </p>
        ) : null}
      </form>
    </EditorSheet>
  );
}
