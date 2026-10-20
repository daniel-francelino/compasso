import { ApprovalStage, EditorialStatus } from "@/lib/shared/enums";

export type StepStatus = "locked" | "todo" | "doing" | "reviewing" | "changes" | "done";

export type StageState = {
  planRequired: boolean;
  stage: ApprovalStage;
  planLocked: boolean;
  artLocked: boolean;
  plan: StepStatus;
  art: StepStatus;
};

const planStep = (status: EditorialStatus, planned: boolean): StepStatus => {
  if (planned) return "done";
  if (status === EditorialStatus.AwaitingPlanApproval) return "reviewing";
  if (status === EditorialStatus.PlanChangesRequested) return "changes";
  return status === EditorialStatus.Draft ? "todo" : "doing";
};

const artStep = (status: EditorialStatus, planned: boolean): StepStatus => {
  if (!planned) return "locked";
  if (status === EditorialStatus.Approved) return "done";
  if (status === EditorialStatus.AwaitingApproval) return "reviewing";
  if (status === EditorialStatus.ChangesRequested) return "changes";
  return status === EditorialStatus.PlanApproved ? "todo" : "doing";
};

export const stageStateOf = (
  status: EditorialStatus,
  planRequired: boolean,
  planApprovedRevisionId: string | null,
): StageState => {
  if (!planRequired) {
    return {
      planRequired,
      stage: ApprovalStage.Art,
      planLocked: false,
      artLocked: false,
      plan: "done",
      art: artStep(status, true),
    };
  }
  const planned = planApprovedRevisionId !== null;
  return {
    planRequired,
    stage: planned ? ApprovalStage.Art : ApprovalStage.Plan,
    planLocked: planned,
    artLocked: !planned,
    plan: planStep(status, planned),
    art: artStep(status, planned),
  };
};
