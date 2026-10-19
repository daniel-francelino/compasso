import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import {
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/shared/admin/form-fields";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import {
  type ContentItemDetail,
  listAssigneeOptions,
  saveContentItem,
} from "@/lib/marketing/content/content.functions";
import { saveItemSchema } from "@/lib/marketing/content/schemas";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NO_ASSIGNEE = "none";

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  fixedBrandId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ContentItemDetail | undefined;
  fixedBrandId?: string | undefined;
  onSaved: (saved: { id: string }) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [brandId, setBrandId] = useState(item?.brandId ?? fixedBrandId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [objective, setObjective] = useState(item?.objective ?? "");
  const [briefing, setBriefing] = useState(item?.briefing ?? "");
  const [notes, setNotes] = useState(item?.internalNotes ?? "");
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? NO_ASSIGNEE);
  const [tags, setTags] = useState(item?.tags.join(", ") ?? "");
  const [dueDate, setDueDate] = useState(item?.productionDueDate ?? "");

  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: open && item === undefined && fixedBrandId === undefined,
  });
  const assignees = useQuery({
    queryKey: QueryKey.Content.assignees(brandId),
    queryFn: async () => unwrapResult(await listAssigneeOptions({ data: { brandId } })).people,
    enabled: open && brandId !== "",
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={item ? "Editar conteúdo" : "Novo conteúdo"}
      description="O conteúdo é a ideia. Depois você cria uma variante para cada canal."
      submitLabel={item ? "Salvar" : "Criar conteúdo"}
      busy={busy}
      size="max-w-xl"
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveItemSchema,
            {
              ...(item ? { id: item.id, expectedVersion: item.version } : {}),
              brandId,
              title,
              objective,
              briefing,
              internalNotes: notes,
              assigneeId: assigneeId === NO_ASSIGNEE ? null : assigneeId,
              tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== ""),
              productionDueDate: dueDate === "" ? null : dueDate,
            },
            (data) => saveContentItem({ data }),
            (result) => {
              onSaved({ id: result.id });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      {item === undefined && fixedBrandId === undefined ? (
        <SelectField
          id="item-brand"
          label="Marca"
          required
          value={brandId}
          onValueChange={(value) => {
            setBrandId(value);
            setAssigneeId(NO_ASSIGNEE);
          }}
          placeholder="Escolha a marca"
          options={(brands.data ?? []).map((brand) => ({
            value: brand.id,
            label: `${brand.name} · ${brand.clientName}`,
          }))}
          error={errors["brandId"]}
        />
      ) : null}
      <TextField
        id="item-title"
        label="Título interno"
        required
        value={title}
        onValueChange={setTitle}
        maxLength={140}
        error={errors["title"]}
        hint="O cliente só vê este título se ele fizer parte do que for enviado."
      />
      <TextField
        id="item-objective"
        label="Objetivo"
        value={objective}
        onValueChange={setObjective}
        maxLength={2000}
        error={errors["objective"]}
      />
      <TextAreaField
        id="item-briefing"
        label="Briefing (interno)"
        value={briefing}
        onValueChange={setBriefing}
        maxLength={8000}
        rows={4}
        error={errors["briefing"]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="item-assignee"
          label="Responsável"
          value={assigneeId}
          onValueChange={setAssigneeId}
          disabled={brandId === ""}
          emptyText={assignees.data?.length === 0 ? "Nenhuma pessoa disponível" : undefined}
          options={[
            { value: NO_ASSIGNEE, label: "Sem responsável" },
            ...(assignees.data ?? []).map((person) => ({ value: person.id, label: person.name })),
          ]}
          error={errors["assigneeId"]}
        />
        <DateField
          id="item-due"
          label="Prazo de produção"
          value={dueDate}
          onValueChange={setDueDate}
          error={errors["productionDueDate"]}
        />
      </div>
      <TextField
        id="item-tags"
        label="Etiquetas"
        value={tags}
        onValueChange={setTags}
        hint="Separe por vírgula. Ex.: campanha, outono"
      />
      <TextAreaField
        id="item-notes"
        label="Notas internas"
        value={notes}
        onValueChange={setNotes}
        maxLength={4000}
        rows={3}
        error={errors["internalNotes"]}
      />
      <FormError message={error} />
    </FormDialog>
  );
}
