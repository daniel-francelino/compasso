import { sizeFitsPage } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import {
  type WorkerDocument,
  type WorkerLimits,
  pixelBytesOf,
} from "@/lib/shared/design/import/worker/protocol";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const badNode = (document: WorkerDocument): boolean => {
  for (const node of document.nodes) {
    if ((node.box === null) !== (node.pixels === null)) return true;
    if (node.group && node.box !== null) return true;
    if (node.box === null || node.pixels === null) continue;
    const outside =
      node.box.left + node.box.width > document.width ||
      node.box.top + node.box.height > document.height;
    if (outside || node.pixels.byteLength !== pixelBytesOf(node.box)) return true;
  }
  return false;
};

export const validateWorkerDocument = (
  document: WorkerDocument,
  limits: WorkerLimits,
): Result<{ document: WorkerDocument }> => {
  const fits = sizeFitsPage(document.width, document.height);
  if (!fits.ok) return fits;
  if (badNode(document) || (document.flattened && document.nodes.length !== 1)) {
    return invalid(DESIGN_IMPORT_MESSAGE.readFailed);
  }
  const drawn = document.nodes.flatMap((node) => (node.box === null ? [] : [node.box]));
  if (drawn.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.noLayers);
  if (drawn.length > limits.capacityElements) {
    return invalid(DESIGN_IMPORT_MESSAGE.tooManyLayers(limits.capacityElements));
  }
  const total = drawn.reduce((sum, box) => sum + pixelBytesOf(box), limits.usedBytes);
  if (total > DESIGN_LIMITS.rasterBudgetBytes) return invalid(DESIGN_IMPORT_MESSAGE.memory);
  return { ok: true, document };
};
