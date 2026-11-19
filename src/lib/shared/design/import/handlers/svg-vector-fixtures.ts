export const SVG_NS = "http://www.w3.org/2000/svg";

export const wrap = (body: string, attributes = 'width="24" height="24" viewBox="0 0 24 24"') =>
  `<svg xmlns="${SVG_NS}" ${attributes}>${body}</svg>`;

export const ICON = wrap(
  `<title>icon</title><g id="mark" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><circle cx="12" cy="12" r="8"/></g>`,
);

export const GRADIENT = wrap(
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/>`,
);

export const RADIAL = wrap(
  `<defs><radialGradient id="r" gradientUnits="userSpaceOnUse" cx="12" cy="12" r="12"><stop offset="0" stop-color="white"/><stop offset="100%" stop-color="black" stop-opacity="0.5"/></radialGradient></defs><circle cx="12" cy="12" r="12" fill="url(#r)"/>`,
);

export const ILLUSTRATOR = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: test -->
<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" width="40px" height="40px" viewBox="0 0 40 40" xml:space="preserve">
<style type="text/css">
  .st0{fill:rgb(255,0,0);}
  .st1{fill:none;stroke:rgb(0,255,0);stroke-width:2;}
  rect{opacity:1}
</style>
<rect class="st0" x="2" y="2" width="10" height="10"/>
<path class="st1" d="M20 20L30 30"/>
</svg>`;

export const USE_REUSE = wrap(
  `<defs><path id="p" d="M0 0h4v4z"/></defs><use href="#p" x="2" y="2"/><use xlink:href="#p" x="10" y="10" fill="red"/>`,
  `xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24"`,
);

export const PATH_COMMANDS = wrap(
  `<path d="M2 2 H10 V10 h-4 v-2 C10 12 12 12 14 10 S18 8 20 10 q2 2 4 0 t2 2 a3 3 0 0 1 3 3 Z" fill="rgb(51,102,153)"/>`,
  `width="40" height="40" viewBox="0 0 40 40"`,
);

export const FIXTURES: Readonly<Record<string, string>> = {
  icon: ICON,
  gradient: GRADIENT,
  radial: RADIAL,
  illustrator: ILLUSTRATOR,
  use: USE_REUSE,
  commands: PATH_COMMANDS,
};
