import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeText } from "@/lib/shared/design/import/handlers/svg-fixtures";
import { ICON } from "@/lib/shared/design/import/handlers/svg-vector-fixtures";
import { SvgFallback } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { SvgResponseSchema } from "@/lib/shared/design/import/worker/svg-protocol";

type Listener = (event: MessageEvent<unknown>) => void;

const posted: unknown[] = [];
let listener: Listener | null = null;

const send = (data: unknown): unknown => {
  posted.length = 0;
  listener?.(new MessageEvent("message", { data }));
  return posted[0];
};

beforeEach(async () => {
  posted.length = 0;
  vi.resetModules();
  vi.stubGlobal("postMessage", (message: unknown) => posted.push(message));
  vi.stubGlobal("addEventListener", (_type: string, handler: Listener) => {
    listener = handler;
  });
  await import("@/lib/shared/design/import/worker/svg.worker");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("svg.worker", () => {
  it("answers a good file with a response the client schema accepts", () => {
    const response = send({ id: 0, bytes: encodeText(ICON) });
    expect(SvgResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ id: 0, status: "result" });
  });

  it("answers a file with no drawable shape with the typed reason", () => {
    const response = send({ id: 3, bytes: encodeText("<svg/>") });
    expect(response).toMatchObject({ id: 3, status: "failure" });
    expect(SvgResponseSchema.safeParse(response).success).toBe(true);
  });

  it("answers a malformed request that carries an id with the internal reason", () => {
    expect(send({ id: 5, bytes: "text" })).toEqual({
      id: 5,
      status: "failure",
      reason: SvgFallback.Internal,
    });
  });

  it("stays silent for a request with no id", () => {
    expect(send({ bytes: new Uint8Array(1) })).toBeUndefined();
  });
});
