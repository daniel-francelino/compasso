import { useState } from "react";
import { Button } from "lost-ui/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "lost-ui/ui/dialog";
import { Label } from "lost-ui/ui/label";
import { RadioGroup, RadioGroupItem } from "lost-ui/ui/radio-group";
import { IMPORT_CHOICE_CANCEL_LABEL } from "@/lib/shared/design/import/messages";
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
          {choice.cancelLabel ?? IMPORT_CHOICE_CANCEL_LABEL}
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
