import { initializeCanvas } from "ag-psd";
import { z } from "zod";
import { DesignImportFailure } from "@/lib/shared/design/import/types";
import {
  WorkerRequestSchema,
  WorkerStatus,
  type WorkerResponse,
} from "@/lib/shared/design/import/worker/protocol";
import { agPsdEngine } from "@/lib/shared/design/import/worker/psd-engine";
import { runPsdRequest } from "@/lib/shared/design/import/worker/psd-runner";

initializeCanvas(
  () => {
    throw new Error("canvas-unavailable");
  },
  (width, height) => new ImageData(width, height),
);

const IdOnlySchema = z.object({ id: z.number().int().min(0) });

const post = (response: WorkerResponse, transfer: ArrayBuffer[]): void => {
  postMessage(response, { transfer });
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  const parsed = WorkerRequestSchema.safeParse(event.data);
  if (parsed.success) {
    void runPsdRequest(parsed.data, agPsdEngine, post);
    return;
  }
  const identified = IdOnlySchema.safeParse(event.data);
  if (identified.success) {
    post(
      { id: identified.data.id, status: WorkerStatus.Error, failure: DesignImportFailure.Corrupt },
      [],
    );
  }
});
