import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type CalendarNote, saveCalendarNote } from "@/lib/marketing/calendar/notes.functions";
import { saveNoteSchema } from "@/lib/marketing/calendar/schemas";
import { CalendarEventType, CalendarNoteKind, CalendarNoteRepeat } from "@/lib/shared/enums";
import { calendarEventTypeLabels, calendarNoteRepeatLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";
import { z } from "zod";
import { instantToLocalInput, plusMs, toIso } from "@/lib/shared/dates";

const FALLBACK_ZONE = "America/Sao_Paulo";
const ONE_HOUR_MS = 3_600_000;

export type EventDialogTarget = {
  day: string;
  brandId: string | undefined;
  note: CalendarNote | undefined;
};

const plusOneHour = (instant: string): string => toIso(plusMs(instant, ONE_HOUR_MS));

export function EventDialog({
  target,
  onOpenChange,
}: {
  target: EventDialogTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const { note } = target;
  const [brandId, setBrandId] = useState(
    note?.brandId ?? target.brandId ?? readStored(StoredKey.CalendarBrand, z.string().uuid(), ""),
  );
  const [title, setTitle] = useState(note?.title ?? "");
  const [eventType, setEventType] = useState<CalendarEventType | null>(
    note?.eventType ?? CalendarEventType.Meeting,
  );
  const [allDay, setAllDay] = useState(note?.allDay ?? true);
  const [noteDate, setNoteDate] = useState(note?.noteDate ?? target.day);
  const [endDate, setEndDate] = useState<string | null>(note?.endDate ?? null);
  const [startsAt, setStartsAt] = useState<string | null>(note?.startsAt ?? null);
  const [endsAt, setEndsAt] = useState<string | null>(note?.endsAt ?? null);
  const [repeat, setRepeat] = useState<CalendarNoteRepeat>(note?.repeat ?? CalendarNoteRepeat.None);
  const [location, setLocation] = useState(note?.location ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [internalNotes, setInternalNotes] = useState(note?.internalNotes ?? "");
  const [clientVisible, setClientVisible] = useState(note?.clientVisible ?? false);
  const brands = useBrandOptions(note === undefined && target.brandId === undefined);
  const brand = useBrand(brandId, brandId !== "");
  const zone = note?.timezone ?? brand.data?.timezone ?? FALLBACK_ZONE;
  const multiDay = endDate !== null && endDate > noteDate;

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={CalendarRange}
      title={note ? "Editar evento" : "Adicionar evento"}
      description="Uma captação, uma reunião ou qualquer compromisso da marca. Se for compartilhado, o cliente vê no portal."
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
              kind: CalendarNoteKind.Event,
              title,
              description,
              noteDate:
                allDay || startsAt === null
                  ? noteDate
                  : instantToLocalInput(startsAt, zone).slice(0, 10),
              endDate: allDay ? endDate : null,
              repeat,
              eventType,
              allDay,
              startsAt: allDay ? null : startsAt,
              endsAt: allDay ? null : endsAt,
              timezone: allDay ? null : zone,
              location,
              clientVisible,
              internalNotes,
            },
            (data) => saveCalendarNote({ data }),
            () => {
              toast.success("Evento salvo.");
              void queryClient.invalidateQueries({ queryKey: QueryKey.Calendar.all() });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      {note === undefined && target.brandId === undefined ? (
        <BrandSelect
          id="event-brand"
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
      <TextField
        id="event-title"
        label="Título"
        required
        value={title}
        onValueChange={setTitle}
        maxLength={140}
        error={errors["title"]}
      />
      <SelectField
        id="event-type"
        label="Tipo"
        required
        value={eventType ?? ""}
        onValueChange={(value) => {
          const match = Object.values(CalendarEventType).find((option) => option === value);
          if (match) setEventType(match);
        }}
        options={Object.values(CalendarEventType).map((option) => ({
          value: option,
          label: calendarEventTypeLabels[option],
        }))}
        error={errors["eventType"]}
      />
      <div className="flex items-center gap-3">
        <Switch id="event-all-day" checked={allDay} onCheckedChange={setAllDay} />
        <Label htmlFor="event-all-day">Dia inteiro</Label>
      </div>
      {allDay ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePickerField
            id="event-date"
            label="Data"
            required
            value={noteDate}
            onChange={setNoteDate}
            error={errors["noteDate"]}
          />
          <DatePickerField
            id="event-end-date"
            label="Até (opcional)"
            value={endDate ?? ""}
            minDate={noteDate}
            clearable
            onChange={(value) => setEndDate(value === "" ? null : value)}
            error={errors["endDate"]}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            id="event-starts"
            label="Início"
            value={startsAt}
            timeZone={zone}
            initialLocal={`${noteDate}T09:00`}
            onValueChange={(instant) => {
              setStartsAt(instant);
              if (instant !== null && endsAt === null) setEndsAt(plusOneHour(instant));
            }}
            error={errors["startsAt"]}
          />
          <DateTimeField
            id="event-ends"
            label="Fim"
            value={endsAt}
            timeZone={zone}
            onValueChange={setEndsAt}
            error={errors["endsAt"]}
          />
        </div>
      )}
      <SelectField
        id="event-repeat"
        label="Repetir"
        value={multiDay ? CalendarNoteRepeat.None : repeat}
        disabled={multiDay}
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
      <TextField
        id="event-location"
        label="Local ou link"
        tip={{
          label: "Sobre o local",
          content: "Um endereço ou um link. Links precisam começar com https://.",
        }}
        value={location}
        onValueChange={setLocation}
        maxLength={200}
        error={errors["location"]}
      />
      <TextAreaField
        id="event-description"
        label="Descrição"
        tip={{
          label: "Sobre a descrição",
          content: "É o que o cliente lê quando o evento é compartilhado.",
        }}
        value={description}
        onValueChange={setDescription}
        maxLength={2000}
        rows={3}
        error={errors["description"]}
      />
      <TextAreaField
        id="event-internal"
        label="Notas internas"
        tip={{
          label: "Sobre as notas internas",
          content: "Só a equipe vê. O cliente nunca recebe.",
        }}
        value={internalNotes}
        onValueChange={setInternalNotes}
        maxLength={4000}
        rows={3}
        error={errors["internalNotes"]}
      />
      <div className="flex items-center gap-3">
        <Switch id="event-visible" checked={clientVisible} onCheckedChange={setClientVisible} />
        <Label htmlFor="event-visible">Visível para o cliente</Label>
        <InfoTip label="Sobre a visibilidade">
          O cliente da marca vê este evento no portal e é avisado quando ele muda.
        </InfoTip>
      </div>
      <FormError message={error} />
    </FormDialog>
  );
}
