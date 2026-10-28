import { describe, expect, it } from "vitest";
import { EditorStep, stepToShow, stepsWithErrors } from "@/lib/marketing/content/editor-steps";
import { followPublishDate, plannedOnDay } from "@/lib/marketing/content/publish-date";

const ZONE = "America/Sao_Paulo";

const row = (plannedAt: string | null, published = false) => ({
  plannedAt,
  plannedTimezone: plannedAt === null ? null : ZONE,
  published,
});

describe("followPublishDate", () => {
  it("gives a row without a date the publication day at the default hour", () => {
    const [moved] = followPublishDate([row(null)], null, "2026-11-03", ZONE);
    expect(moved?.plannedAt).toBe(plannedOnDay("2026-11-03", ZONE));
    expect(moved?.plannedTimezone).toBe(ZONE);
  });

  it("moves only the rows that were on the previous publication day, keeping the hour", () => {
    const same = plannedOnDay("2026-11-03", ZONE);
    const other = plannedOnDay("2026-11-05", ZONE);
    const [followed, kept] = followPublishDate(
      [row(same), row(other)],
      "2026-11-03",
      "2026-11-10",
      ZONE,
    );
    expect(followed?.plannedAt).toBe(plannedOnDay("2026-11-10", ZONE));
    expect(kept?.plannedAt).toBe(other);
  });

  it("leaves published rows and a cleared date alone", () => {
    const at = plannedOnDay("2026-11-03", ZONE);
    const rows = [row(at, true)];
    expect(followPublishDate(rows, "2026-11-03", "2026-11-10", ZONE)).toEqual(rows);
    expect(followPublishDate([row(at)], "2026-11-03", null, ZONE)[0]?.plannedAt).toBe(at);
  });
});

describe("editor step of a field error", () => {
  it("sends a forgotten title from the content step to the planning step", () => {
    expect(stepToShow({ title: "Informe o nome." }, false, EditorStep.Content)).toBe(
      EditorStep.Planning,
    );
  });

  it("stays on the current step when it already has an error", () => {
    expect(stepToShow({ title: "x", caption: "y" }, true, EditorStep.Content)).toBeNull();
  });

  it("maps the channel selection by whether rows exist", () => {
    expect([...stepsWithErrors({ channels: "x" }, false)]).toEqual([EditorStep.Planning]);
    expect([...stepsWithErrors({ channels: "x" }, true)]).toEqual([EditorStep.Content]);
  });
});
