import { z } from "zod";
import { parseSvgVector } from "@/lib/shared/design/import/handlers/svg-vector";
import { SvgFallback } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { SvgRequestSchema, type SvgResponse } from "@/lib/shared/design/import/worker/svg-protocol";

const IdOnlySchema = z.object({ id: z.number().int().min(0) });

const post = (response: SvgResponse): void => {
  postMessage(response);
};

const rejectUnparsed = (data: unknown): void => {
  const identified = IdOnlySchema.safeParse(data);
  if (!identified.success) return;
  post({ id: identified.data.id, status: "failure", reason: SvgFallback.Internal });
};

const handle = (data: unknown): void => {
  const parsed = SvgRequestSchema.safeParse(data);
  if (!parsed.success) {
    rejectUnparsed(data);
    return;
  }
  const { id, bytes } = parsed.data;
  try {
    const result = parseSvgVector(bytes);
    post(
      result.ok
        ? {
            id,
            status: "result",
            width: result.width,
            height: result.height,
            shapes: result.shapes,
            dataBytes: result.dataBytes,
          }
        : { id, status: "failure", reason: result.reason },
    );
  } catch {
    post({ id, status: "failure", reason: SvgFallback.Internal });
  }
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  handle(event.data);
});
