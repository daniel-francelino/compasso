import { useEffect, useRef, useState } from "react";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { PixelHistorySession } from "@/hooks/shared/design/use-pixel-history";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import {
  type FilterJob,
  FilterCancelledError,
  startFilterJob,
} from "@/lib/shared/design/filter-client";
import { PAINT_UPLOAD_REASON } from "@/lib/shared/design/paint";
import { pixelToolReason } from "@/lib/shared/design/rasterize";
import {
  DESIGN_FILTER_LABEL,
  type DesignFilter,
  FILTER_REASON,
  type FilterParams,
  defaultFilterParams,
  filterSignature,
  normalizeFilterParams,
} from "@/lib/shared/design/raster/filter-types";
import {
  blendFiltered,
  cropBuffer,
  planFilter,
  restoreRegion,
} from "@/lib/shared/design/raster/filter-run";
import { recordStroke } from "@/lib/shared/design/raster/pixel-history";
import {
  type PixelBuffer,
  type Rect,
  clonePixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";
import { maskBoundingBox, type SelectionMask } from "@/lib/shared/design/raster/selection";
import { snapshotRect, type TileData } from "@/lib/shared/design/raster/tiles";
import { DesignElementKind } from "@/lib/shared/design/types";
import { logError } from "@/lib/shared/logger";

const PREVIEW_DELAY_MS = 150;

const SEED_RANGE = 0x7fffffff;

type Session = {
  key: string;
  original: PixelBuffer;
  region: Rect;
  mask: SelectionMask | null;
  job: FilterJob | null;
  timer: ReturnType<typeof setTimeout> | null;
  latest: { signature: string; filtered: PixelBuffer } | null;
  version: number;
};

export type FilterState = {
  filter: DesignFilter;
  params: FilterParams;
  working: boolean;
  failed: boolean;
};

const isCancel = (error: unknown): boolean => error instanceof FilterCancelledError;

const stopWork = (current: Session) => {
  if (current.timer !== null) clearTimeout(current.timer);
  current.timer = null;
  current.job?.cancel();
  current.job = null;
};

export const useDesignFilter = ({
  editor,
  rasters,
  pixels,
  selection,
  canPaint,
}: {
  editor: DesignEditor;
  rasters: RasterHandle;
  pixels: PixelHistorySession;
  selection: SelectionController;
  canPaint: boolean;
}) => {
  const [state, setState] = useState<FilterState | null>(null);
  const session = useRef<Session | null>(null);
  const { store } = rasters;
  const { stroking } = pixels;
  const layer = editor.single;
  const usable = layer?.kind === DesignElementKind.Raster && !layer.locked && !layer.hidden;
  const missing = usable ? undefined : pixelToolReason(FILTER_REASON, layer);
  const reason = canPaint ? missing : PAINT_UPLOAD_REASON;

  const patchState = (patch: Partial<FilterState>) =>
    setState((value) => (value === null ? value : { ...value, ...patch }));

  const compute = async (current: Session, params: FilterParams): Promise<PixelBuffer | null> => {
    const signature = filterSignature(params);
    if (current.latest?.signature === signature) return current.latest.filtered;
    const { original, region } = current;
    const plan = planFilter(original.width, original.height, region, params);
    if (plan === null) return null;
    current.job?.cancel();
    const job = startFilterJob(cropBuffer(original, plan.crop), plan.inner, params);
    current.job = job;
    try {
      const filtered = await job.result;
      current.latest = { signature, filtered };
      return filtered;
    } finally {
      if (current.job === job) current.job = null;
    }
  };

  const preview = async (current: Session, params: FilterParams) => {
    current.version += 1;
    const version = current.version;
    patchState({ working: true, failed: false });
    try {
      const filtered = await compute(current, params);
      const buffer = store.get(current.key);
      const stale = session.current !== current || current.version !== version;
      if (stale) return;
      if (filtered === null || buffer === undefined) {
        patchState({ working: false });
        return;
      }
      blendFiltered(buffer, current.original, filtered, current.region, current.mask);
      store.markChanged(current.key);
      patchState({ working: false });
    } catch (error) {
      if (isCancel(error)) return;
      logError(error);
      patchState({ working: false, failed: true });
    }
  };

  const schedule = (current: Session, params: FilterParams) => {
    if (current.timer !== null) clearTimeout(current.timer);
    current.timer = setTimeout(() => {
      current.timer = null;
      void preview(current, params);
    }, PREVIEW_DELAY_MS);
  };

  const close = () => {
    const current = session.current;
    session.current = null;
    pixels.stroking.current = false;
    setState(null);
    if (current === null) return;
    stopWork(current);
    current.version += 1;
  };

  const cancel = () => {
    const current = session.current;
    const buffer = current === null ? undefined : store.get(current.key);
    if (current !== null && buffer !== undefined) {
      restoreRegion(buffer, current.original, current.region);
      store.markChanged(current.key);
    }
    close();
  };

  const open = (filter: DesignFilter) => {
    if (reason !== undefined || layer?.kind !== DesignElementKind.Raster) return;
    const buffer = store.get(layer.id);
    if (buffer === undefined) return;
    const mask = selection.layerMask(layer);
    const area = mask === null ? null : maskBoundingBox(mask);
    if (mask !== null && area === null) return;
    const region = area ?? { x: 0, y: 0, width: buffer.width, height: buffer.height };
    const params = defaultFilterParams(filter, Math.floor(Math.random() * SEED_RANGE));
    const current: Session = {
      key: layer.id,
      original: clonePixelBuffer(buffer),
      region,
      mask,
      job: null,
      timer: null,
      latest: null,
      version: 0,
    };
    session.current = current;
    pixels.stroking.current = true;
    setState({ filter, params, working: true, failed: false });
    schedule(current, params);
  };

  const setParams = (next: FilterParams) => {
    const current = session.current;
    if (current === null) return;
    const params = normalizeFilterParams(next);
    patchState({ params });
    schedule(current, params);
  };

  const commit = (current: Session, filter: DesignFilter, filtered: PixelBuffer) => {
    const buffer = store.get(current.key);
    if (buffer === undefined) return;
    const before = new Map<number, TileData>();
    snapshotRect(current.original, before, current.region);
    blendFiltered(buffer, current.original, filtered, current.region, current.mask);
    const patch = recordStroke(before, buffer);
    store.markChanged(current.key);
    if (patch.tiles.length === 0) return;
    const label = DESIGN_FILTER_LABEL[filter];
    const stepId = crypto.randomUUID();
    pixels.history.push(label, current.key, patch, stepId);
    editor.markPixelStep(label, stepId);
  };

  const apply = async () => {
    const current = session.current;
    if (current === null || state === null) return;
    if (current.timer !== null) clearTimeout(current.timer);
    current.timer = null;
    patchState({ working: true, failed: false });
    try {
      const filtered = await compute(current, state.params);
      if (session.current !== current) return;
      if (filtered === null) {
        patchState({ working: false });
        return;
      }
      commit(current, state.filter, filtered);
      close();
    } catch (error) {
      if (isCancel(error)) return;
      logError(error);
      patchState({ working: false, failed: true });
    }
  };

  useEffect(
    () => () => {
      const current = session.current;
      if (current !== null) stopWork(current);
      stroking.current = false;
    },
    [stroking],
  );

  return { state, reason, open, setParams, apply, cancel };
};

export type FilterController = ReturnType<typeof useDesignFilter>;
