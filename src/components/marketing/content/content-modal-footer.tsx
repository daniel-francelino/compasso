import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentSaveButton } from "@/components/marketing/content/content-actions";
import { Button } from "@/components/shared/ui/button";
import { EditorStep } from "@/lib/marketing/content/editor-steps";

export function ContentModalFooter({
  step,
  onStep,
  onClose,
  isNew,
  editable,
  dirty,
  saving,
}: {
  step: EditorStep;
  onStep: (step: EditorStep) => void;
  onClose: () => void;
  isNew: boolean;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
}) {
  return (
    <footer className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 sm:px-6">
      {step === EditorStep.Content ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onStep(EditorStep.Planning)}
        >
          <ChevronLeft aria-hidden="true" />
          Voltar
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      )}
      <div className="flex items-center gap-2">
        {step === EditorStep.Planning ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onStep(EditorStep.Content)}
          >
            Conteúdo
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : null}
        <ContentSaveButton isNew={isNew} editable={editable} dirty={dirty} saving={saving} />
      </div>
    </footer>
  );
}
