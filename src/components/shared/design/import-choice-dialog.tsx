import { useState } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Label } from "@/components/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/shared/ui/radio-group";
import { PDF_PAGE_CHOICE } from "@/lib/shared/design/import/messages";
import type { ImportChoice } from "@/lib/shared/design/import/types";

function ChoiceBody({
  choice,
  onAnswer,
  onCancel,
}: {
  choice: ImportChoice;
  onAnswer: (optionId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(choice.options[0]?.id ?? "");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{choice.title}</DialogTitle>
      </DialogHeader>
      <RadioGroup
        value={selected}
        onValueChange={setSelected}
        aria-label={choice.title}
        className="max-h-72 overflow-y-auto"
      >
        {choice.options.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <RadioGroupItem value={option.id} id={`import-choice-${option.id}`} />
            <Label htmlFor={`import-choice-${option.id}`} className="cursor-pointer">
              {option.label}
              {option.detail === undefined ? null : (
                <span className="ml-2 text-muted-foreground">{option.detail}</span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {PDF_PAGE_CHOICE.cancelLabel}
        </Button>
        <Button type="button" disabled={selected === ""} onClick={() => onAnswer(selected)}>
          {choice.confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ImportChoiceDialog({
  choice,
  onAnswer,
  onCancel,
}: {
  choice: ImportChoice | null;
  onAnswer: (optionId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={choice !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        {choice === null ? null : (
          <ChoiceBody choice={choice} onAnswer={onAnswer} onCancel={onCancel} />
        )}
      </DialogContent>
    </Dialog>
  );
}
