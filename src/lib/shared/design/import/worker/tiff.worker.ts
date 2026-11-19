import { z } from "zod";
import { TiffRefusal } from "@/lib/shared/design/import/worker/tiff-header";
import { isUtifLike, runTiff, type UtifLike } from "@/lib/shared/design/import/worker/tiff-engine";
import {
  TiffRequestSchema,
  type TiffResponse,
} from "@/lib/shared/design/import/worker/tiff-protocol";

const IdOnlySchema = z.object({ id: z.number().int().min(0) });

const post = (response: TiffResponse, transfer: ArrayBuffer[]): void => {
  postMessage(response, { transfer });
};

const loadUtif = async (): Promise<UtifLike> => {
  const loaded: unknown = await import("utif2");
  const candidate: unknown =
    typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
  if (!isUtifLike(candidate)) throw new Error("utif-missing");
  return candidate;
};

const rejectUnparsed = (data: unknown): void => {
  const identified = IdOnlySchema.safeParse(data);
  if (!identified.success) return;
  post({ id: identified.data.id, status: "error", refusal: TiffRefusal.Corrupt }, []);
};

const handle = async (data: unknown): Promise<void> => {
  const parsed = TiffRequestSchema.safeParse(data);
  if (!parsed.success) {
    rejectUnparsed(data);
    return;
  }
  const { id, file, usedBytes } = parsed.data;
  try {
    const utif = await loadUtif();
    const output = await runTiff(id, await file.arrayBuffer(), usedBytes, utif);
    post(output.response, output.transfer);
  } catch {
    post({ id, status: "error", refusal: TiffRefusal.Corrupt }, []);
  }
};

globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handle(event.data);
});
