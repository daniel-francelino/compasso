import { Ban, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextAreaField } from "@/components/shared/admin/form-fields";

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  icon: Icon = Ban,
  minLength = 3,
  optional = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  icon?: LucideIcon;
  minLength?: number;
  optional?: boolean;
  onSubmit: (reason: string) => Promise<string | null | false>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!optional && reason.trim().length < minLength) {
      setError("Indique o motivo.");
      return;
    }
    setBusy(true);
    const failure = await onSubmit(reason.trim());
    setBusy(false);
    if (failure === false) return;
    if (failure) {
      setError(failure);
      return;
    }
    setReason("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Icon}
      title={title}
      description={description}
      busy={busy}
      destructive={!optional}
      submitLabel={confirmLabel}
      submitIcon={Icon}
      onSubmit={submit}
    >
      <TextAreaField
        id={`${id}-reason`}
        label={optional ? "Motivo (opcional)" : "Motivo"}
        rows={3}
        maxLength={300}
        value={reason}
        disabled={busy}
        onValueChange={setReason}
      />
      <FormError message={error} />
    </FormDialog>
  );
}
