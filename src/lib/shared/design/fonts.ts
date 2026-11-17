import bebasNeue400 from "@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url";
import cormorant400Italic from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2?url";
import cormorant400 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2?url";
import cormorant700Italic from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-italic.woff2?url";
import cormorant700 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2?url";
import dmSans400Italic from "@fontsource/dm-sans/files/dm-sans-latin-400-italic.woff2?url";
import dmSans400 from "@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url";
import dmSans700Italic from "@fontsource/dm-sans/files/dm-sans-latin-700-italic.woff2?url";
import dmSans700 from "@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url";
import inter400Italic from "@fontsource/inter/files/inter-latin-400-italic.woff2?url";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import inter700Italic from "@fontsource/inter/files/inter-latin-700-italic.woff2?url";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import lora400Italic from "@fontsource/lora/files/lora-latin-400-italic.woff2?url";
import lora400 from "@fontsource/lora/files/lora-latin-400-normal.woff2?url";
import lora700Italic from "@fontsource/lora/files/lora-latin-700-italic.woff2?url";
import lora700 from "@fontsource/lora/files/lora-latin-700-normal.woff2?url";
import montserrat400Italic from "@fontsource/montserrat/files/montserrat-latin-400-italic.woff2?url";
import montserrat400 from "@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url";
import montserrat700Italic from "@fontsource/montserrat/files/montserrat-latin-700-italic.woff2?url";
import montserrat700 from "@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url";
import playfair400Italic from "@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url";
import playfair400 from "@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url";
import playfair700Italic from "@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url";
import playfair700 from "@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url";
import poppins400Italic from "@fontsource/poppins/files/poppins-latin-400-italic.woff2?url";
import poppins400 from "@fontsource/poppins/files/poppins-latin-400-normal.woff2?url";
import poppins700Italic from "@fontsource/poppins/files/poppins-latin-700-italic.woff2?url";
import poppins700 from "@fontsource/poppins/files/poppins-latin-700-normal.woff2?url";
import { DesignFont, designFontFamily } from "@/lib/shared/design/types";

type FontFiles = {
  regular: string;
  italic?: string;
  bold?: string;
  boldItalic?: string;
};

const FILES: Record<DesignFont, FontFiles> = {
  [DesignFont.DmSans]: {
    regular: dmSans400,
    italic: dmSans400Italic,
    bold: dmSans700,
    boldItalic: dmSans700Italic,
  },
  [DesignFont.Cormorant]: {
    regular: cormorant400,
    italic: cormorant400Italic,
    bold: cormorant700,
    boldItalic: cormorant700Italic,
  },
  [DesignFont.Montserrat]: {
    regular: montserrat400,
    italic: montserrat400Italic,
    bold: montserrat700,
    boldItalic: montserrat700Italic,
  },
  [DesignFont.PlayfairDisplay]: {
    regular: playfair400,
    italic: playfair400Italic,
    bold: playfair700,
    boldItalic: playfair700Italic,
  },
  [DesignFont.Poppins]: {
    regular: poppins400,
    italic: poppins400Italic,
    bold: poppins700,
    boldItalic: poppins700Italic,
  },
  [DesignFont.Lora]: {
    regular: lora400,
    italic: lora400Italic,
    bold: lora700,
    boldItalic: lora700Italic,
  },
  [DesignFont.BebasNeue]: { regular: bebasNeue400 },
  [DesignFont.Inter]: {
    regular: inter400,
    italic: inter400Italic,
    bold: inter700,
    boldItalic: inter700Italic,
  },
};

const loaded = new Map<string, Promise<void>>();

const register = (font: DesignFont, url: string, weight: string, style: string): Promise<void> => {
  const key = `${font}:${weight}:${style}`;
  const known = loaded.get(key);
  if (known !== undefined) return known;
  const face = new FontFace(designFontFamily(font), `url(${url}) format("woff2")`, {
    weight,
    style,
  });
  const promise = face
    .load()
    .then((ready) => {
      document.fonts.add(ready);
    })
    .catch(() => {
      loaded.delete(key);
    });
  loaded.set(key, promise);
  return promise;
};

export const loadDesignFont = (font: DesignFont, bold: boolean, italic: boolean): Promise<void> => {
  const files = FILES[font];
  const url =
    (bold && italic ? files.boldItalic : undefined) ??
    (bold ? files.bold : undefined) ??
    (italic ? files.italic : undefined) ??
    files.regular;
  const real = url === files.regular ? { weight: "400", style: "normal" } : null;
  const weight = real?.weight ?? (bold && url !== files.italic ? "700" : "400");
  const style = real?.style ?? (italic && url !== files.bold ? "italic" : "normal");
  return register(font, url, weight, style);
};
