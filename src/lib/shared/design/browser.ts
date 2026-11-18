import { type DesignPalette, normalizeColor } from "@/lib/shared/design/document";
import type { PageSize } from "@/lib/shared/design/types";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import { MediaVariant } from "@/lib/shared/media/schemas";

export type CanvasChrome = DesignPalette & { line: string };

const token = (name: string): string | null =>
  normalizeColor(getComputedStyle(document.documentElement).getPropertyValue(name));

export const readCanvasChrome = (): CanvasChrome | null => {
  const ink = token("--ink");
  const surface = token("--surface");
  const accent = token("--violet");
  const line = token("--line-strong");
  if (ink === null || surface === null || accent === null || line === null) return null;
  return { ink, surface, accent, line };
};

export const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

const CONTROLS =
  "button, a[href], summary, [role='button'], [role='switch'], [role='checkbox'], [role='tab'], [role='menuitem'], [role='option']";

export const isControlTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(CONTROLS) !== null;

export const imageNaturalSize = async (versionId: string): Promise<PageSize | null> => {
  const result = await signMediaUrls({
    data: { versionIds: [versionId], variant: MediaVariant.Display },
  });
  const url = result.ok ? result.urls[versionId] : undefined;
  const image = url === undefined ? null : await loadImage(url);
  return image === null ? null : { width: image.naturalWidth, height: image.naturalHeight };
};

export const writeClipboardImage = async (blob: Blob): Promise<boolean> => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
};

export const readClipboardImage = async (): Promise<Blob | null> => {
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((name) => name.startsWith("image/"));
      if (type !== undefined) return await item.getType(type);
    }
    return null;
  } catch {
    return null;
  }
};
