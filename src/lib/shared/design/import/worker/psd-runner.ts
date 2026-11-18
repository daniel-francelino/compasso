import type { Psd } from "ag-psd";
import { decodePsd, type PsdPixelSource } from "@/lib/shared/design/import/handlers/psd-decode";
import { planPsd } from "@/lib/shared/design/import/handlers/psd-plan";
import { DESIGN_IMPORT_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import {
  type WorkerRequest,
  type WorkerResponse,
  WorkerStatus,
  transferablesOf,
} from "@/lib/shared/design/import/worker/protocol";
import { DesignImportFailure, DesignImportFormat } from "@/lib/shared/design/import/types";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const MEMORY_ERROR = "Exceeded memory limit";

export type PsdEngine = {
  readStructure: (buffer: ArrayBuffer) => Psd;
  source: PsdPixelSource;
};

export type PostResponse = (response: WorkerResponse, transfer: ArrayBuffer[]) => void;

const failureOf = (error: unknown): DesignImportFailure => {
  if (error instanceof RangeError) return DesignImportFailure.Memory;
  if (error instanceof Error && error.message === MEMORY_ERROR) return DesignImportFailure.Memory;
  return DesignImportFailure.Corrupt;
};

const fail = (id: number, failure: DesignImportFailure, post: PostResponse): void =>
  post({ id, status: WorkerStatus.Error, failure }, []);

export const runPsdRequest = async (
  request: WorkerRequest,
  engine: PsdEngine,
  post: PostResponse,
): Promise<void> => {
  const { id, limits } = request;
  if (request.format !== DesignImportFormat.Psd) return fail(id, DesignImportFailure.Corrupt, post);
  try {
    const psd = engine.readStructure(await request.file.arrayBuffer());
    if (!sizeFitsPage(psd.width, psd.height).ok) return fail(id, DesignImportFailure.Corrupt, post);
    const planned = planPsd(psd, {
      capacityElements: limits.capacityElements,
      remainingBytes: DESIGN_LIMITS.rasterBudgetBytes - limits.usedBytes,
      maxLayerSide: DESIGN_IMPORT_LIMITS.maxLayerSide,
    });
    if (!planned.ok) return fail(id, planned.failure, post);
    const document = decodePsd(psd, planned.plan, engine.source, (done, total) =>
      post({ id, status: WorkerStatus.Progress, done, total }, []),
    );
    if (document.nodes.every((node) => node.pixels === null)) {
      return fail(id, DesignImportFailure.NoLayers, post);
    }
    post({ id, status: WorkerStatus.Result, document }, transferablesOf(document));
  } catch (error) {
    fail(id, failureOf(error), post);
  }
};
