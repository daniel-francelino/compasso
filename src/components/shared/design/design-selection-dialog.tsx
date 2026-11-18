import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { useState } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import {
  SELECTION_ADJUST_LABEL,
  SELECTION_LIMITS,
  SelectionAdjust,
} from "@/lib/shared/design/selection-state";

const DEFAULT_AMOUNT = 4;

export function DesignSelectionDialog({
  kind,
  onApply,
  onClose,
}: {
  kind: SelectionAdjust | null;
  onApply: (kind: SelectionAdjust, amount: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const max =
    kind === SelectionAdjust.Feather ? SELECTION_LIMITS.maxFeather : SELECTION_LIMITS.maxGrow;
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === null ? "" : SELECTION_ADJUST_LABEL[kind]}</DialogTitle>
        </DialogHeader>
        <FormInputNumber
          name="selection-adjust-amount"
          label="Valor (px)"
          value={amount}
          min={1}
          max={max}
          step={1}
          onValueChange={(next) => {
            if (next !== null) setAmount(Math.round(next));
          }}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (kind !== null) onApply(kind, amount);
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
