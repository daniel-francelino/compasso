import { useQuery } from "@tanstack/react-query";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { FileText } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { RichTextEditor } from "@/components/shared/admin/rich-text-editor";
import { TagInputField } from "@/components/shared/admin/tag-input-field";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import {
  type ContentItemDetail,
  listAssigneeOptions,
  saveContentItem,
} from "@/lib/marketing/content/content.functions";
import { saveItemSchema } from "@/lib/marketing/content/schemas";
import type { RichDoc } from "@/lib/shared/rich-text/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NO_ASSIGNEE = "none";

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  fixedBrandId,
  onSaved,
  fullScreen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ContentItemDetail | undefined;
  fixedBrandId?: string | undefined;
  onSaved: (saved: { id: string }) => void;
  fullScreen?: boolean;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [brandId, setBrandId] = useState(item?.brandId ?? fixedBrandId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [objective, setObjective] = useState(item?.objective ?? "");
  const [briefing, setBriefing] = useState<RichDoc | null>(item?.briefing ?? null);
  const [notes, setNotes] = useState(item?.internalNotes ?? "");
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? NO_ASSIGNEE);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [dueDate, setDueDate] = useState(item?.productionDueDate ?? "");

  const brands = useBrandOptions(open && item === undefined && fixedBrandId === undefined);
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
      size={
        fullScreen
          ? "h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 p-5 sm:max-w-none sm:rounded-none sm:p-8"
          : "max-w-xl"
      }
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
              tags,
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
        <BrandSelect
          id="item-brand"
          required
          value={brandId}
          onValueChange={(value) => {
            setBrandId(value);
            setAssigneeId(NO_ASSIGNEE);
          }}
          placeholder="Escolha a marca"
          brands={brands.data}
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
      <RichTextEditor
        id="item-briefing"
        label="Briefing (interno)"
        value={briefing}
        onValueChange={setBriefing}
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
        <DatePickerField
          id="item-due"
          label="Prazo de produção"
          value={dueDate}
          onChange={setDueDate}
          clearable
          error={errors["productionDueDate"]}
        />
      </div>
      <TagInputField
        id="item-tags"
        label="Etiquetas"
        value={tags}
        onValueChange={setTags}
        maxItems={20}
        maxLength={40}
        error={errors["tags"]}
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
