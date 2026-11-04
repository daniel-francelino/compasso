import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { decidePortalApproval } from "@/lib/portal/approvals/portal.functions";
import { ApprovalOutcome } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";

export const useFeedDecision = (requestId: string, onDecided: () => void) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (outcome: ApprovalOutcome, comment: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await decidePortalApproval({ data: { id: requestId, outcome, comment } });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    onDecided();
    toast.success(
      outcome === ApprovalOutcome.Approved
        ? "Aprovação registrada."
        : "Pedido de alteração enviado.",
    );
    await queryClient.invalidateQueries({ queryKey: QueryKey.Portal.all() });
    await queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.all() });
    return true;
  };

  return { busy, error, decide };
};
