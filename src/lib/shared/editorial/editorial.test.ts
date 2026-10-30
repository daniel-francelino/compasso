import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DirectMoves,
  EditorialTransitions,
  canTransition,
  combinedRule,
  fileCountProblem,
  formatRules,
  mediaProblem,
  platformFormats,
  submitStageOf,
} from "@/lib/shared/editorial/editorial";
import { ApprovalStage, ContentFormat, EditorialStatus, Platform } from "@/lib/shared/enums";

const sqlTransitions = (): Record<string, string[]> => {
  const sql = readFileSync("supabase/migrations/20261030100000_simplified_approval.sql", "utf8");
  const body = sql.match(/function public\.editorial_transition_allowed[\s\S]*?\$fn\$;/)?.[0] ?? "";
  const map: Record<string, string[]> = {};
  for (const match of body.matchAll(/when '([a-z_]+)' then p_to in \(([^)]*)\)/g)) {
    const from = match[1] ?? "";
    map[from] = [...(match[2] ?? "").matchAll(/'([a-z_]+)'/g)].map((item) => item[1] ?? "");
  }
  return map;
};

describe("editorial transitions", () => {
  it("match the SQL function that guards the table", () => {
    const fromSql = sqlTransitions();
    for (const status of Object.values(EditorialStatus)) {
      expect([...(fromSql[status] ?? [])].sort()).toEqual([...EditorialTransitions[status]].sort());
    }
  });

  it("never leave a cancelled variant", () => {
    expect(EditorialTransitions[EditorialStatus.Cancelled]).toEqual([]);
    expect(canTransition(EditorialStatus.Approved, EditorialStatus.InProduction)).toBe(true);
    expect(canTransition(EditorialStatus.Published, EditorialStatus.Approved)).toBe(false);
  });

  it("allow direct moves only where the transition itself is allowed", () => {
    for (const from of Object.values(EditorialStatus)) {
      for (const to of DirectMoves[from]) expect(canTransition(from, to)).toBe(true);
    }
  });

  it("never offer a direct move into approval, decision or cancellation", () => {
    const forbidden: EditorialStatus[] = [
      EditorialStatus.AwaitingApproval,
      EditorialStatus.Approved,
      EditorialStatus.ChangesRequested,
      EditorialStatus.Cancelled,
    ];
    for (const from of Object.values(EditorialStatus)) {
      for (const to of DirectMoves[from]) expect(forbidden).not.toContain(to);
    }
  });
});

describe("formats", () => {
  it("define at least one format for every platform, all of them valid", () => {
    for (const platform of Object.values(Platform)) {
      expect(platformFormats[platform].length).toBeGreaterThan(0);
      for (const format of platformFormats[platform]) {
        expect(Object.values(ContentFormat)).toContain(format);
      }
    }
  });

  it("explain a wrong number of files", () => {
    expect(fileCountProblem(ContentFormat.Carousel, 1)).toBe("Adicione ao menos 2 arquivos.");
    expect(fileCountProblem(ContentFormat.Video, 2)).toBe("Este formato aceita 1 arquivo.");
    expect(fileCountProblem(ContentFormat.Text, 0)).toBeNull();
    expect(formatRules[ContentFormat.Carousel].max).toBe(20);
  });

  it("combine the rules of several formats into the strictest one", () => {
    const rule = combinedRule([ContentFormat.Carousel, ContentFormat.Video]);
    expect([rule.min, rule.max]).toEqual([2, 1]);
    expect(combinedRule([]).max).toBe(formatRules[ContentFormat.Other].max);
    expect(mediaProblem([ContentFormat.Image, ContentFormat.Video], 2)).toBe(
      "Este formato aceita 1 arquivo.",
    );
    expect(mediaProblem([ContentFormat.Image, ContentFormat.Text], 1)).toBeNull();
  });
});

describe("submitStageOf", () => {
  it("sends the art once there is text or files, and the planning before that", () => {
    expect(submitStageOf("", 0)).toBe(ApprovalStage.Plan);
    expect(submitStageOf("   ", 0)).toBe(ApprovalStage.Plan);
    expect(submitStageOf("Texto", 0)).toBe(ApprovalStage.Art);
    expect(submitStageOf("", 2)).toBe(ApprovalStage.Art);
  });
});
