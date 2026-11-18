import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { DESIGN_SHORTCUT_HELP } from "@/lib/shared/design/types";

export function DesignShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>
            Atalhos de uma letra são ignorados enquanto você digita em um campo.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {DESIGN_SHORTCUT_HELP.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-muted-foreground">{keys}</dt>
              <dd>{action}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="font-mono text-muted-foreground">Alt + ↑ / ↓</dt>
            <dd>Mover a camada focada na lista</dd>
          </div>
          <div className="contents">
            <dt className="font-mono text-muted-foreground">F2</dt>
            <dd>Renomear a camada focada</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
