import { useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { Alert, AlertDescription } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useDecisionDraft } from "@/hooks/portal/use-decision-draft";
import { decidePortalApproval } from "@/lib/portal/approvals/portal.functions";
import { MIN_CHANGE_COMMENT } from "@/lib/portal/approvals/schemas";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalOutcome } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";

export function RequestDecisionActions({ request }: { request: PortalRequest }) {
  const queryClient = useQueryClient();
  const draft = useDecisionDraft(request.id);
  const [confirming, setConfirming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(outcome: ApprovalOutcome, comment: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await decidePortalApproval({ data: { id: request.id, outcome, comment } });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    draft.clear();
    toast.success(
      outcome === ApprovalOutcome.Approved
        ? "Aprovação registrada."
        : "Pedido de alterações enviado.",
    );
    await queryClient.invalidateQueries({ queryKey: QueryKey.Portal.all() });
    await queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.all() });
    return true;
  }

  if (!request.canDecide) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sua decisão">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setAsking(true)}>
          <MessageSquareWarning aria-hidden="true" />
          Pedir alterações
        </Button>
        <Button type="button" disabled={busy} onClick={() => setConfirming(true)}>
          <Check aria-hidden="true" />
          Aprovar
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Aprovar esta versão?"
        description={
          <div className="space-y-2">
            <p>
              A equipe será avisada de que você aprovou exatamente o conteúdo enviado. A decisão não
              pode ser desfeita por você.
            </p>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Aprovar"
        busy={busy}
        onConfirm={() => decide(ApprovalOutcome.Approved, "")}
      />
      <FormDialog
        open={asking}
        onOpenChange={setAsking}
        icon={MessageSquareWarning}
        title="Pedir alterações"
        description="Conte à equipe o que precisa mudar. O comentário é obrigatório."
        submitLabel="Enviar pedido"
        submitDisabled={draft.text.trim().length < MIN_CHANGE_COMMENT}
        busy={busy}
        onSubmit={async () => {
          if (await decide(ApprovalOutcome.ChangesRequested, draft.text.trim())) setAsking(false);
        }}
      >
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <TextAreaField
          id={`portal-changes-${request.id}`}
          label="O que precisa mudar"
          value={draft.text}
          onValueChange={draft.change}
          maxLength={4000}
          rows={5}
          disabled={busy}
          error={
            draft.text.length > 0 && draft.text.trim().length < MIN_CHANGE_COMMENT
              ? "Escreva ao menos 5 letras."
              : undefined
          }
        />
      </FormDialog>
    </div>
  );
}
