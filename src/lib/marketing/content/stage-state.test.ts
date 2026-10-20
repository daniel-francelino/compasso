import { describe, expect, it } from "vitest";
import { stageStateOf } from "@/lib/marketing/content/stage-state";
import { ApprovalStage } from "@/lib/shared/enums";

describe("stageStateOf", () => {
  it("keeps the single art cycle when the plan is not required", () => {
    const state = stageStateOf(false, null);
    expect(state.stage).toBe(ApprovalStage.Art);
    expect(state.planLocked).toBe(false);
  });

  it("keeps the plan editable while the plan is not approved", () => {
    const state = stageStateOf(true, null);
    expect(state.stage).toBe(ApprovalStage.Plan);
    expect(state.planLocked).toBe(false);
  });

  it("locks the plan and opens the art once the plan is approved", () => {
    const state = stageStateOf(true, "rev-1");
    expect(state.stage).toBe(ApprovalStage.Art);
    expect(state.planLocked).toBe(true);
  });
});
