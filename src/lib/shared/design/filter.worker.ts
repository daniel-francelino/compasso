import type { FilterRequest, FilterResponse } from "@/lib/shared/design/filter-client";
import { executeFilter } from "@/lib/shared/design/raster/filter-run";

globalThis.addEventListener("message", (event: MessageEvent<FilterRequest>) => {
  const { data, width, height, inner, params } = event.data;
  const crop = { width, height, data: new Uint8ClampedArray(data) };
  const result = executeFilter(crop, inner, params);
  const response: FilterResponse = { data: new Uint8ClampedArray(result.data).buffer };
  postMessage(response, { transfer: [response.data] });
});
