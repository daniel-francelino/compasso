import { ArrowLeft, Check, type LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode, Ref } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";

export function FormDialog({
  open,
  onOpenChange,
  title,
  icon: Icon,
  description,
  children,
  busy = false,
  submitLabel,
  submitIcon: SubmitIcon = Check,
  destructive = false,
  submitDisabled = false,
  onSubmit,
  form,
  size,
  cancelLabel = "Voltar",
  cancelIcon: CancelIcon = ArrowLeft,
  submitSize,
  bodyClassName = "space-y-4",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  icon: LucideIcon;
  description?: ReactNode;
  children?: ReactNode;
  busy?: boolean;
  submitLabel: string;
  submitIcon?: LucideIcon;
  destructive?: boolean;
  submitDisabled?: boolean;
  onSubmit?: () => void | Promise<void>;
  form?: {
    onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
    ref?: Ref<HTMLFormElement>;
    noValidate?: boolean;
  };
  size?: string;
  cancelLabel?: string;
  cancelIcon?: LucideIcon;
  submitSize?: "default" | "sm" | "lg";
  bodyClassName?: string;
}) {
  function submit() {
    if (!busy) void onSubmit?.();
  }

  const footer = (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
        <CancelIcon aria-hidden="true" />
        {cancelLabel}
      </Button>
      <Button
        type={form ? "submit" : "button"}
        {...(form ? {} : { onClick: submit })}
        variant={destructive ? "destructive" : "default"}
        {...(submitSize ? { size: submitSize } : {})}
        disabled={submitDisabled}
        loading={busy}
      >
        <SubmitIcon aria-hidden="true" />
        {submitLabel}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent {...(size ? { className: size } : {})}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {form ? (
          <form
            className={bodyClassName}
            onSubmit={form.onSubmit}
            {...(form.ref ? { ref: form.ref } : {})}
            {...(form.noValidate ? { noValidate: true } : {})}
          >
            {children}
            {footer}
          </form>
        ) : (
          <div className={bodyClassName}>
            {children}
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
