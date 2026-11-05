import { Form } from "lost-ui/forms/form";
import { FormCheckbox } from "lost-ui/forms/form-checkbox";
import { FormInputRating } from "lost-ui/forms/form-input-rating";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import { rules } from "lost-ui/forms/rules";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import type { ReactNode } from "react";
import { FieldGroup } from "@/components/shared/admin/field-group";
import type { FeedbackDraft } from "@/hooks/portal/use-feedback-draft";
import { FEEDBACK_SCORE_MAX, FEEDBACK_TEXT_MAX } from "@/lib/shared/feedback/limits";
import {
  feedbackQuestions,
  feedbackScoreWord,
  questionText,
} from "@/lib/shared/feedback/questions";
import { FeedbackQuestion } from "@/lib/shared/feedback/types";

export function FeedbackForm({
  id,
  monthName,
  draft,
  onChange,
  onSubmit,
  errors,
  error,
  footer,
}: {
  id: string;
  monthName: string;
  draft: FeedbackDraft;
  onChange: (draft: FeedbackDraft) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  error: string | null;
  footer: ReactNode;
}) {
  const setScore = (key: FeedbackQuestion, value: number) =>
    onChange({
      ...draft,
      scores: { ...draft.scores, [key]: value },
      skipped: draft.skipped.filter((item) => item !== key),
    });

  const setSkipped = (key: FeedbackQuestion, skipped: boolean) =>
    onChange({
      ...draft,
      scores: skipped ? { ...draft.scores, [key]: 0 } : draft.scores,
      skipped: skipped ? [...draft.skipped, key] : draft.skipped.filter((item) => item !== key),
    });

  return (
    <Form id={id} className="space-y-6" onSubmit={onSubmit}>
      {feedbackQuestions.map((info) => {
        const value = draft.scores[info.key];
        const skipped = draft.skipped.includes(info.key);
        return (
          <FieldGroup key={info.key} legend={info.label} hideLegend gap="sm">
            <FormInputRating
              name={info.key}
              label={info.label}
              description={questionText(info, monthName)}
              hint={info.help}
              max={FEEDBACK_SCORE_MAX}
              value={value}
              disabled={skipped}
              required={info.required}
              onValueChange={(next) => setScore(info.key, next)}
              rules={info.required ? [rules.min(1, "Escolha uma nota geral.")] : []}
              error={errors[info.key] !== undefined}
              {...(errors[info.key] ? { errorMessage: errors[info.key] } : {})}
            />
            <p
              id={`${id}-${info.key}-word`}
              className="min-h-5 text-sm font-medium text-foreground"
              aria-live="polite"
            >
              {skipped ? "Você preferiu não avaliar." : feedbackScoreWord(value)}
            </p>
            {info.required ? null : (
              <FormCheckbox
                name={`${info.key}-skip`}
                label="Prefiro não avaliar"
                value={skipped}
                onValueChange={(next) => setSkipped(info.key, next)}
              />
            )}
          </FieldGroup>
        );
      })}
      <FormTextarea
        name="highlight"
        label="O que você mais gostou?"
        value={draft.highlight}
        rows={3}
        onValueChange={(next) => onChange({ ...draft, highlight: next })}
        hint={`${draft.highlight.length} de ${FEEDBACK_TEXT_MAX} caracteres`}
        rules={[rules.maxLength(FEEDBACK_TEXT_MAX, "O comentário é longo demais.")]}
        error={errors["highlight"] !== undefined}
        {...(errors["highlight"] ? { errorMessage: errors["highlight"] } : {})}
      />
      <FormTextarea
        name="improvement"
        label="O que podemos melhorar?"
        value={draft.improvement}
        rows={3}
        onValueChange={(next) => onChange({ ...draft, improvement: next })}
        hint={`${draft.improvement.length} de ${FEEDBACK_TEXT_MAX} caracteres`}
        rules={[rules.maxLength(FEEDBACK_TEXT_MAX, "O comentário é longo demais.")]}
        error={errors["improvement"] !== undefined}
        {...(errors["improvement"] ? { errorMessage: errors["improvement"] } : {})}
      />
      {draft.scores[FeedbackQuestion.Overall] > 0 && draft.scores[FeedbackQuestion.Overall] <= 2 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Conte o que podemos melhorar logo acima.
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {footer}
    </Form>
  );
}
