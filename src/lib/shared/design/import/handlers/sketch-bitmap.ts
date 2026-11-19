import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

export const decodeBitmapWithBrowser = async (
  data: Uint8Array,
  target: { width: number; height: number },
): Promise<PixelBuffer | null> => {
  if (typeof OffscreenCanvas === "undefined") return null;
  const bitmap = await createImageBitmap(new Blob([data.slice()]), {
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: "high",
  });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return null;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: pixels.width, height: pixels.height, data: pixels.data };
  } finally {
    bitmap.close();
  }
};
