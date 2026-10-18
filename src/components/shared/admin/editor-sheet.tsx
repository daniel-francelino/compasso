import { Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/shared/ui/sheet";

export function EditorSheet({
  open,
  onClose,
  restoreFocus,
  title,
  description,
  formId,
  busy,
  saveDisabled = false,
  footerStart,
  children,
}: {
  open: boolean;
  onClose: () => void;
  restoreFocus: (event: Event) => void;
  title: string;
  description?: string;
  formId: string;
  busy: boolean;
  saveDisabled?: boolean;
  footerStart?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        overlayClassName="bg-ink-soft/40"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={restoreFocus}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <SheetHeader className="shrink-0 px-6 pb-6 pt-6 pr-14 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        <SheetFooter className="shrink-0 border-t border-border px-6 py-4 sm:justify-between sm:space-x-0">
          <div>{footerStart}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              <X aria-hidden="true" />
              Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={busy || saveDisabled} loading={busy}>
              <Save aria-hidden="true" />
              Salvar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
