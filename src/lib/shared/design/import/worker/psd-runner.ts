import type { Psd } from "ag-psd";
import { decodePsd, type PsdPixelSource } from "@/lib/shared/design/import/handlers/psd-decode";
import {
  type PlanLimits,
  type PlanResult,
  planFlattened,
  planPsd,
} from "@/lib/shared/design/import/handlers/psd-plan";
import { DESIGN_IMPORT_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import {
  type WorkerDocument,
  type WorkerRequest,
  type WorkerResponse,
  WorkerStatus,
  transferablesOf,
} from "@/lib/shared/design/import/worker/protocol";
import { DesignImportFailure, DesignImportFormat } from "@/lib/shared/design/import/types";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const MEMORY_ERROR = "Exceeded memory limit";
const ALLOCATION_FAILURE = /allocation/i;

export type PsdEngine = {
  readStructure: (buffer: ArrayBuffer, options?: { composite: boolean }) => Psd;
  source: PsdPixelSource;
};

export type PostResponse = (response: WorkerResponse, transfer: ArrayBuffer[]) => void;

const failureOf = (error: unknown): DesignImportFailure => {
  if (error instanceof RangeError && ALLOCATION_FAILURE.test(error.message)) {
    return DesignImportFailure.Memory;
  }
  if (error instanceof Error && error.message === MEMORY_ERROR) return DesignImportFailure.Memory;
  return DesignImportFailure.Corrupt;
};

const fail = (id: number, failure: DesignImportFailure, post: PostResponse): void =>
  post({ id, status: WorkerStatus.Error, failure }, []);

const isEmpty = (document: WorkerDocument): boolean =>
  document.nodes.every((node) => node.pixels === null);

type Stage = { document: WorkerDocument } | { failure: DesignImportFailure };

const decodeFlattened = (
  buffer: ArrayBuffer,
  limits: PlanLimits,
  engine: PsdEngine,
  post: (done: number, total: number) => void,
): Stage => {
  const flat = engine.readStructure(buffer, { composite: true });
  const planned: PlanResult = planFlattened(flat, limits);
  if (!planned.ok) return { failure: planned.failure };
  const document = decodePsd(flat, planned.plan, engine.source, post);
  return isEmpty(document) ? { failure: DesignImportFailure.NoLayers } : { document };
};

export const runPsdRequest = async (
  request: WorkerRequest,
  engine: PsdEngine,
  post: PostResponse,
): Promise<void> => {
  const { id, limits } = request;
  if (request.format !== DesignImportFormat.Psd) return fail(id, DesignImportFailure.Corrupt, post);
  try {
    const buffer = await request.file.arrayBuffer();
    const psd = engine.readStructure(buffer);
    if (!sizeFitsPage(psd.width, psd.height).ok) return fail(id, DesignImportFailure.Corrupt, post);
    const planLimits: PlanLimits = {
      capacityElements: limits.capacityElements,
      remainingBytes: DESIGN_LIMITS.rasterBudgetBytes - limits.usedBytes,
      maxLayerSide: DESIGN_IMPORT_LIMITS.maxLayerSide,
    };
    const planned = planPsd(psd, planLimits);
    if (!planned.ok) return fail(id, planned.failure, post);
    const progress = (done: number, total: number): void =>
      post({ id, status: WorkerStatus.Progress, done, total }, []);
    const layered = decodePsd(psd, planned.plan, engine.source, progress);
    const stage: Stage =
      isEmpty(layered) && planned.plan.nodes[0]?.composite !== true
        ? decodeFlattened(buffer, planLimits, engine, progress)
        : { document: layered };
    if ("failure" in stage) return fail(id, stage.failure, post);
    if (isEmpty(stage.document)) return fail(id, DesignImportFailure.NoLayers, post);
    post(
      { id, status: WorkerStatus.Result, document: stage.document },
      transferablesOf(stage.document),
    );
  } catch (error) {
    fail(id, failureOf(error), post);
  }
};
