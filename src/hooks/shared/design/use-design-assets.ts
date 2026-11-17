import { useEffect, useRef, useState } from "react";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { loadImage } from "@/lib/shared/design/browser";
import { imageVersionIds } from "@/lib/shared/design/document";
import { loadDesignFont } from "@/lib/shared/design/fonts";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { DesignElementKind, type DesignFont } from "@/lib/shared/design/types";
import { MediaVariant } from "@/lib/shared/media/schemas";

export type LoadedImages = ReadonlyMap<string, HTMLImageElement | null>;

type FontSpec = { font: DesignFont; bold: boolean; italic: boolean };

const fontSpecs = (document: DesignDocument): FontSpec[] => {
  const specs = new Map<string, FontSpec>();
  for (const page of document.pages) {
    for (const element of page.elements) {
      if (element.kind !== DesignElementKind.Text) continue;
      specs.set(`${element.font}:${element.bold}:${element.italic}`, {
        font: element.font,
        bold: element.bold,
        italic: element.italic,
      });
    }
  }
  return [...specs.values()];
};

export const loadFontsOf = async (document: DesignDocument): Promise<void> => {
  await Promise.all(
    fontSpecs(document).map((spec) => loadDesignFont(spec.font, spec.bold, spec.italic)),
  );
};

export const useDesignAssets = (
  document: DesignDocument,
  variant: MediaVariant = MediaVariant.Display,
) => {
  const ids = imageVersionIds(document);
  const signed = useSignedUrls(ids, variant);
  const [images, setImages] = useState<LoadedImages>(new Map());
  const [fontsVersion, setFontsVersion] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const urls = signed.data;
  const idsKey = ids.join("|");
  const requested = useRef(new Set<string>());
  const fontsKey = fontSpecs(document)
    .map((spec) => `${spec.font}:${spec.bold}:${spec.italic}`)
    .join("|");
  const latest = useRef(document);
  latest.current = document;

  useEffect(() => {
    if (urls === undefined) return;
    const wanted = idsKey === "" ? [] : idsKey.split("|");
    const fresh = wanted.filter((id) => !requested.current.has(id));
    for (const id of fresh) requested.current.add(id);
    void Promise.all(
      fresh.map(async (id) => {
        const url = urls[id];
        return [id, url === undefined ? null : await loadImage(url)] as const;
      }),
    ).then((loaded) => {
      if (loaded.length === 0) return;
      setImages((current) => new Map([...current, ...loaded]));
    });
  }, [urls, idsKey]);

  useEffect(() => {
    let active = true;
    setFontsReady(false);
    void loadFontsOf(latest.current).then(() => {
      if (!active) return;
      setFontsVersion((value) => value + 1);
      setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, [fontsKey]);

  const imagesReady = ids.every((id) => images.has(id));
  return {
    images,
    fontsVersion,
    ready: fontsReady && imagesReady,
    failed: signed.isError,
  };
};
