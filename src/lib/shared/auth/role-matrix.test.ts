import { describe, expect, it } from "vitest";
import { Action } from "@/lib/shared/auth/actions";
import {
  groupByModule,
  visibleActions,
  withDependencies,
  withoutDependents,
} from "@/lib/shared/auth/role-matrix";
import type { ActionInfo } from "@/lib/shared/auth/roles.functions";

const action = (
  key: string,
  requires: string[] = [],
  extra: Partial<ActionInfo> = {},
): ActionInfo => ({
  key,
  module: key.split(".")[0] ?? "",
  description: key,
  adminOnly: false,
  portal: false,
  requires,
  ...extra,
});

const catalog = [
  action(Action.Content.View),
  action(Action.Content.Update, [Action.Content.View]),
  action(Action.Content.Submit, [Action.Content.Update]),
  action(Action.Users.Manage, [], { adminOnly: true }),
  action(Action.Portal.View, [], { portal: true }),
];

describe("role matrix", () => {
  it("adds the dependencies of a chosen action, transitively", () => {
    const result = withDependencies(new Set(), catalog, [Action.Content.Submit]);
    expect([...result].sort()).toEqual([
      Action.Content.Submit,
      Action.Content.Update,
      Action.Content.View,
    ]);
  });

  it("keeps what was already chosen", () => {
    const result = withDependencies(new Set([Action.Portal.View]), catalog, [
      Action.Content.Update,
    ]);
    expect(result.has(Action.Portal.View)).toBe(true);
    expect(result.has(Action.Content.View)).toBe(true);
  });

  it("removes the actions that depend on a removed one, transitively", () => {
    const all = new Set([
      Action.Content.View,
      Action.Content.Update,
      Action.Content.Submit,
      Action.Portal.View,
    ]);
    const result = withoutDependents(all, catalog, [Action.Content.View]);
    expect([...result]).toEqual([Action.Portal.View]);
  });

  it("hides administration-only actions and, for portal roles, internal ones", () => {
    expect(visibleActions(catalog, false).map((item) => item.key)).not.toContain(
      Action.Users.Manage,
    );
    expect(visibleActions(catalog, true).map((item) => item.key)).toEqual([Action.Portal.View]);
  });

  it("groups by module keeping the order", () => {
    const groups = groupByModule(visibleActions(catalog, false));
    expect(groups.map((group) => group.module)).toEqual(["content", "portal"]);
    expect(groups[0]?.actions).toHaveLength(3);
  });
});
