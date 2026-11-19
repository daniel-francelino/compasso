import { z } from "zod";
import { decodeBitmapWithBrowser } from "@/lib/shared/design/import/handlers/sketch-bitmap";
import { canvasTextPainter } from "@/lib/shared/design/import/handlers/sketch-render";
import { runSketch } from "@/lib/shared/design/import/worker/sketch-engine";
import {
  SketchRefusal,
  SketchRequestSchema,
  type SketchResponse,
} from "@/lib/shared/design/import/worker/sketch-protocol";

const IdOnlySchema = z.object({ id: z.number().int().min(0) });

const post = (response: SketchResponse, transfer: ArrayBuffer[]): void => {
  postMessage(response, { transfer });
};

const rejectUnparsed = (data: unknown): void => {
  const identified = IdOnlySchema.safeParse(data);
  if (!identified.success) return;
  post({ id: identified.data.id, status: "error", refusal: SketchRefusal.Corrupt, args: [] }, []);
};

const handle = async (data: unknown): Promise<void> => {
  const parsed = SketchRequestSchema.safeParse(data);
  if (!parsed.success) {
    rejectUnparsed(data);
    return;
  }
  const { file, ...request } = parsed.data;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const output = await runSketch(request, bytes, {
      decodeBitmap: decodeBitmapWithBrowser,
      paintText: canvasTextPainter,
    });
    post(output.response, output.transfer);
  } catch {
    post({ id: request.id, status: "error", refusal: SketchRefusal.Corrupt, args: [] }, []);
  }
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handle(event.data);
});
