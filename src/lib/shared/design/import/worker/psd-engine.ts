import {
  getCompositeImageData,
  getLayerImageData,
  getLayerMaskImageData,
  readPsd,
  type ReadOptions,
} from "ag-psd";
import type { PsdPixelSource } from "@/lib/shared/design/import/handlers/psd-decode";
import type { PsdEngine } from "@/lib/shared/design/import/worker/psd-runner";

export const PSD_STRUCTURE_OPTIONS = {
  useRawData: true,
  useRawThumbnail: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
  skipLinkedFilesData: true,
  imageResourcesWhitelist: [],
} satisfies ReadOptions;

const source: PsdPixelSource = {
  layerPixels: getLayerImageData,
  maskPixels: getLayerMaskImageData,
  compositePixels: getCompositeImageData,
};

export const agPsdEngine: PsdEngine = {
  readStructure: (buffer) => readPsd(buffer, PSD_STRUCTURE_OPTIONS),
  source,
};
