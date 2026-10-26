import { describe, expect, it } from "vitest";
import { signState, verifyState } from "@/lib/shared/social/oauth-state.server";

const state = {
  channelId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
};

describe("oauth state", () => {
  it("round-trips a signed state", () => {
    expect(verifyState(signState(state, "secret"), "secret")).toEqual(state);
  });

  it("refuses another secret", () => {
    expect(verifyState(signState(state, "secret"), "other")).toBeNull();
  });

  it("refuses a tampered state", () => {
    const [encoded, mac] = signState(state, "secret").split(".");
    const forged = Buffer.from(
      `${state.channelId}.33333333-3333-3333-3333-333333333333.${Date.now() + 1000}`,
    ).toString("base64url");
    expect(verifyState(`${forged}.${mac}`, "secret")).toBeNull();
    expect(encoded).toBeDefined();
  });

  it("refuses an expired state", () => {
    const old = signState(state, "secret", Date.now() - 11 * 60 * 1000);
    expect(verifyState(old, "secret")).toBeNull();
  });

  it("refuses text that is not a state", () => {
    expect(verifyState("nonsense", "secret")).toBeNull();
    expect(verifyState("", "secret")).toBeNull();
  });
});
