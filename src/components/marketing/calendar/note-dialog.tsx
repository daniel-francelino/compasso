import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Lightbulb } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type CalendarNote, saveCalendarNote } from "@/lib/marketing/calendar/notes.functions";
import { saveNoteSchema } from "@/lib/marketing/calendar/schemas";
import { CalendarNoteKind, CalendarNoteRepeat } from "@/lib/shared/enums";
import { calendarNoteKindLabels, calendarNoteRepeatLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";
import { z } from "zod";

export type NoteDialogTarget = {
  kind: CalendarNoteKind;
  day: string;
  brandId: string | undefined;
  note: CalendarNote | undefined;
};

export function NoteDialog({
  target,
  onOpenChange,
}: {
  target: NoteDialogTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const { note } = target;
  const [brandId, setBrandId] = useState(
    note?.brandId ?? target.brandId ?? readStored(StoredKey.CalendarBrand, z.string().uuid(), ""),
  );
  const [title, setTitle] = useState(note?.title ?? "");
  const [noteDate, setNoteDate] = useState(note?.noteDate ?? target.day);
  const [repeat, setRepeat] = useState<CalendarNoteRepeat>(note?.repeat ?? CalendarNoteRepeat.None);
  const [description, setDescription] = useState(note?.description ?? "");
  const [clientVisible, setClientVisible] = useState(note?.clientVisible ?? false);
  const brands = useBrandOptions(note === undefined && target.brandId === undefined);
  const isIdea = target.kind === CalendarNoteKind.Idea;
  const kindLabel = calendarNoteKindLabels[target.kind].toLowerCase();

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={isIdea ? Lightbulb : CalendarDays}
      title={`${note ? "Editar" : "Adicionar"} ${kindLabel}`}
      description={
        isIdea
          ? "Uma ideia de conteúdo para planejar depois. Você pode convertê-la em conteúdo."
          : "Um dia importante para a marca, como uma data comemorativa ou um lançamento."
      }
      submitLabel={note ? "Salvar" : "Adicionar"}
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveNoteSchema,
            {
              ...(note ? { id: note.id, expectedVersion: note.version } : {}),
              brandId,
              kind: target.kind,
              title,
              description,
              noteDate,
              repeat,
              clientVisible: isIdea ? false : clientVisible,
            },
            (data) => saveCalendarNote({ data }),
            () => {
              toast.success(`${calendarNoteKindLabels[target.kind]} salva.`);
              void queryClient.invalidateQueries({ queryKey: QueryKey.Calendar.all() });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      {note === undefined && target.brandId === undefined ? (
        <BrandSelect
          id="note-brand"
          required
          value={brandId}
          onValueChange={(value) => {
            setBrandId(value);
            writeStored(StoredKey.CalendarBrand, value);
          }}
          placeholder="Escolha a marca"
          brands={brands.data}
          error={errors["brandId"]}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerField
          id="note-date"
          label="Data"
          required
          value={noteDate}
          onChange={setNoteDate}
          error={errors["noteDate"]}
        />
        <SelectField
          id="note-repeat"
          label="Repetir"
          value={repeat}
          onValueChange={(value) => {
            const match = Object.values(CalendarNoteRepeat).find((option) => option === value);
            if (match) setRepeat(match);
          }}
          options={Object.values(CalendarNoteRepeat).map((option) => ({
            value: option,
            label: calendarNoteRepeatLabels[option],
          }))}
          error={errors["repeat"]}
        />
      </div>
      <TextField
        id="note-title"
        label="Título"
        required
        value={title}
        onValueChange={setTitle}
        maxLength={140}
        error={errors["title"]}
      />
      <TextAreaField
        id="note-description"
        label="Descrição"
        value={description}
        onValueChange={setDescription}
        maxLength={2000}
        rows={4}
        error={errors["description"]}
      />
      {isIdea ? null : (
        <div className="flex items-center gap-3">
          <Switch id="note-visible" checked={clientVisible} onCheckedChange={setClientVisible} />
          <Label htmlFor="note-visible">Visível para o cliente</Label>
          <InfoTip label="Sobre a visibilidade">
            O cliente da marca vê esta data no portal e é avisado quando ela muda.
          </InfoTip>
        </div>
      )}
      <FormError message={error} />
    </FormDialog>
  );
}
