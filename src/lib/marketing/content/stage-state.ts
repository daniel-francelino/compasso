import { ApprovalStage } from "@/lib/shared/enums";

export type StageState = {
  planRequired: boolean;
  stage: ApprovalStage;
  planLocked: boolean;
};

export const stageStateOf = (
  planRequired: boolean,
  planApprovedRevisionId: string | null,
): StageState => {
  if (!planRequired) {
    return {
      planRequired,
      stage: ApprovalStage.Art,
      planLocked: false,
    };
  }
  const planned = planApprovedRevisionId !== null;
  return {
    planRequired,
    stage: planned ? ApprovalStage.Art : ApprovalStage.Plan,
    planLocked: planned,
  };
};
