import { useEffect, useRef, useState } from "react";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import {
  CROP_TOO_SMALL,
  type CropBox,
  type CropHandle,
  CropRatio,
  dragCrop,
  fitRatio,
  fullCrop,
  hitCrop,
  isFullCrop,
  isValidCrop,
  newCrop,
  ratioValue,
} from "@/lib/shared/design/crop";
import { DesignTool, type PageSize } from "@/lib/shared/design/types";
import type { Point } from "@/lib/shared/design/viewport";

type Drag = { handle: CropHandle | null; origin: CropBox; start: Point };

export type CropCallbacks = {
  onCropStart: (point: Point) => void;
  onCropMove: (point: Point) => void;
  onCropEnd: () => void;
};

export type CropController = {
  active: boolean;
  box: CropBox;
  ratio: CropRatio;
  fixedRatio: boolean;
  setRatio: (ratio: CropRatio) => void;
  reason: string | undefined;
  changed: boolean;
  callbacks: CropCallbacks;
  commit: () => void;
  cancel: () => void;
};

export const useDesignCrop = ({
  tool,
  editor,
  size,
  zoom,
  onDone,
}: {
  tool: DesignTool;
  editor: DesignEditor;
  size: PageSize;
  zoom: number;
  onDone: () => void;
}): CropController => {
  const active = tool === DesignTool.Crop;
  const [held, setHeld] = useState<CropBox | null>(null);
  const [ratio, setRatioState] = useState<CropRatio>(CropRatio.Free);
  const drag = useRef<Drag | null>(null);
  const box = held ?? fullCrop(size);
  const value = ratioValue(ratio, size);

  useEffect(() => {
    setHeld(null);
    drag.current = null;
  }, [active, size.width, size.height]);

  const onCropStart = (point: Point) => {
    if (!active) return;
    const handle = hitCrop(box, point, zoom, value !== null);
    drag.current = { handle, origin: box, start: point };
    if (handle === null) setHeld(newCrop(point, point, value, size));
  };

  const onCropMove = (point: Point) => {
    const current = drag.current;
    if (current === null) return;
    setHeld(
      current.handle === null
        ? newCrop(current.start, point, value, size)
        : dragCrop(current.origin, current.handle, current.start, point, value, size),
    );
  };

  const onCropEnd = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.handle === null && held !== null && (held.width < 2 || held.height < 2)) {
      setHeld(null);
    }
  };

  const setRatio = (next: CropRatio) => {
    setRatioState(next);
    const nextValue = ratioValue(next, size);
    if (nextValue !== null) setHeld(fitRatio(box, nextValue));
  };

  const valid = isValidCrop(box);
  const changed = !isFullCrop(box, size);

  return {
    active,
    box,
    ratio,
    fixedRatio: value !== null,
    setRatio,
    reason: valid ? undefined : CROP_TOO_SMALL,
    changed,
    callbacks: { onCropStart, onCropMove, onCropEnd },
    commit: () => {
      if (!valid) return;
      if (changed) editor.crop(box);
      onDone();
    },
    cancel: () => {
      setHeld(null);
      onDone();
    },
  };
};
