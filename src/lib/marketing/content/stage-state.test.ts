import { describe, expect, it } from "vitest";
import { stageStateOf } from "@/lib/marketing/content/stage-state";
import { ApprovalStage, EditorialStatus } from "@/lib/shared/enums";

describe("stageStateOf", () => {
  it("keeps the single art cycle when the plan is not required", () => {
    const state = stageStateOf(EditorialStatus.Draft, false, null);
    expect(state.stage).toBe(ApprovalStage.Art);
    expect(state.planLocked).toBe(false);
    expect(state.artLocked).toBe(false);
  });

  it("blocks the art and keeps the plan editable while the plan is not approved", () => {
    const state = stageStateOf(EditorialStatus.Planning, true, null);
    expect(state.stage).toBe(ApprovalStage.Plan);
    expect(state.planLocked).toBe(false);
    expect(state.artLocked).toBe(true);
    expect(state.plan).toBe("doing");
    expect(state.art).toBe("locked");
  });

  it("shows the plan as reviewing while it is with the client", () => {
    expect(stageStateOf(EditorialStatus.AwaitingPlanApproval, true, null).plan).toBe("reviewing");
    expect(stageStateOf(EditorialStatus.PlanChangesRequested, true, null).plan).toBe("changes");
  });

  it("locks the plan and opens the art once the plan is approved", () => {
    const state = stageStateOf(EditorialStatus.PlanApproved, true, "rev-1");
    expect(state.stage).toBe(ApprovalStage.Art);
    expect(state.planLocked).toBe(true);
    expect(state.artLocked).toBe(false);
    expect(state.plan).toBe("done");
    expect(state.art).toBe("todo");
  });

  it("follows the art through review and approval", () => {
    expect(stageStateOf(EditorialStatus.InProduction, true, "rev-1").art).toBe("doing");
    expect(stageStateOf(EditorialStatus.AwaitingApproval, true, "rev-1").art).toBe("reviewing");
    expect(stageStateOf(EditorialStatus.ChangesRequested, true, "rev-1").art).toBe("changes");
    expect(stageStateOf(EditorialStatus.Approved, true, "rev-1").art).toBe("done");
  });
});
