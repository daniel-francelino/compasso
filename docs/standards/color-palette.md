# Compasso color palette

> Based on the site reference image (peach, pink and lilac gradient, violet and coral ornaments, navy text). Values are estimated by eye from the image and then tuned for **high contrast (WCAG AAA, 7:1, for body text on its intended surfaces)**; they can be refined with the original brand file. Tokens live in `src/styles.css`. No component uses hex values, pure black, pure white or the default Tailwind palette (enforced by ESLint).

## 1. Brand colors

| Token | Hex | Origin in the image | Role |
|---|---|---|---|
| `ink` | `#7A6E90` | Navy text "Marketing • Social Media" | Main text (deep navy, not black) |
| `ink-soft` | `#2F3A75` | Lighter step of the same navy | Secondary text, captions |
| `violet` | `#5B33B0` | Purple patches, bottom right | Primary color: main action, links, focus |
| `violet-deep` | `#43238A` | Deeper step of the violet | Hover and pressed state of the primary action; links on tinted backgrounds |
| `violet-bright` | `#8B5CE6` | Brightest purple of the patches | **Ornaments and large shapes only** (never text) |
| `orchid` | `#D9A8EE` | Star sparkles | Ornaments, highlights, emphasis badges |
| `orchid-light` | `#EBE1FA` | Background of the text labels | Highlight backgrounds, active menu item |
| `rose` | `#F9C4D2` | Center of the gradient | Secondary backgrounds, soft emphasis |
| `peach` | `#FDDCCB` | Top left of the gradient | Section backgrounds, ornaments |
| `coral` | `#FF9A7C` | Orange patch, top corner | Warm accent: ornaments, indicators (fill only) |
| `coral-dark` | `#8F2A17` | Coral with text-grade contrast | Text and icons for soft alerts, soft destructive action |
| `sage` | `#DCE8DA` | Grey-green, top left corner | Soft background for success and confirmations |
| `cactus` | `#2F5A2B` | Green of the phone case | Success, approved |

## 2. Warm neutrals (replace pure grey, black and white)

| Token | Hex | Role |
|---|---|---|
| `ivory` | `#F7F4FB` | Page background (a soft lilac-tinted neutral, so cards and the sidebar stand out from it) |
| `surface` | `#FFFDFE` | Cards, panels, popovers |
| `cream` | `#F2EEF8` | Secondary backgrounds, `muted`, alternate table rows |
| `line` | `#E2DAEA` | Decorative dividers and card borders |
| `line-strong` | `#7A6E90` | **Interactive borders** (inputs, checkboxes, outlined buttons): a calm grey-violet, contrast 3.98 or more on every surface (the minimum for UI components is 3) |

## 3. State colors

| Token | Value | Use |
|---|---|---|
| `success` | `cactus` | Approved, done, published |
| `warning` | `#5E3C00` | Waiting, deadline close |
| `danger` | `#9B1C14` | Error, destructive action |
| `info` | `ink-soft` | Neutral information |

State is never communicated by color alone: there is always an icon or text next to it.

## 4. Editorial statuses (single `statusStyles` map)

| Status | Background | Text and icon | UI label (pt-BR) |
|---|---|---|---|
| `draft` | `cream` | `ink-soft` | "Rascunho" |
| `in_production` | `orchid-light` | `violet-deep` | "Em produção" |
| `internal_review` | `rose` | `ink` | "Em revisão interna" |
| `awaiting_approval` | `peach` | `warning` | "Aguardando aprovação" |
| `changes_requested` | `coral` | `ink` | "Alterações solicitadas" |
| `approved` | `sage` | `cactus` | "Aprovado" |
| `cancelled` | `cream` | `ink-soft`, struck through | "Cancelado" |

Publication statuses (`unplanned`, `planned`, `published_manually`, `cancelled`) use the same visual map, each with its own icon.

## 5. Verified contrast (WCAG 2.1 relative luminance formula)

Thresholds: AA is 4.5 for normal text; AAA is 7. UI components need 3 or more. Target of this palette: **7 or more for body text on page and card surfaces (no exception now: the lowest is `cactus` on `cream`, 7.01); 6 or more for text on tinted badges**.

### Text on the main surfaces

| Text on background | Ratio |
|---|---|
| `ink` on `ivory` | 13.43 |
| `ink` on `surface` | 14.43 |
| `ink` on `cream` | 12.78 |
| `ink-soft` on `ivory` | 9.73 |
| `ink-soft` on `surface` | 10.46 |
| `ink-soft` on `cream` | 9.26 |
| `violet` on `ivory` (links) | 7.58 |
| `violet` on `surface` (links) | 8.15 |
| `violet` on `cream` (links) | 7.21 |
| `ivory` on `violet` (primary button) | 7.58 |
| `ivory` on `violet-deep` (button hover) | 10.45 |
| `ivory` on `danger` (destructive button) | 7.51 |
| `danger` on `ivory` | 7.51 |
| `danger` on `cream` | 7.14 |
| `coral-dark` on `ivory` | 7.68 |
| `coral-dark` on `cream` | 7.31 |
| `cactus` on `ivory` | 7.37 |
| `cactus` on `cream` | 7.01 |
| `warning` on `ivory` | 9.09 |
| `warning` on `cream` | 8.65 |

### Text on tinted backgrounds (badges, highlights, sidebar)

| Text on background | Ratio |
|---|---|
| `ink` on `peach` | 11.33 |
| `ink` on `orchid-light` | 11.61 |
| `ink` on `rose` | 9.64 |
| `ink` on `sage` | 11.55 |
| `ink` on `orchid` | 7.51 |
| `ink` on `coral` | 7.08 |
| `ink-soft` on `peach` | 8.21 |
| `ink-soft` on `orchid-light` | 8.41 |
| `ink-soft` on `rose` | 6.99 |
| `violet-deep` on `orchid-light` | 9.04 |
| `violet-deep` on `peach` | 8.82 |
| `violet-deep` on `rose` | 7.50 |
| `violet` on `peach` | 6.39 |
| `violet` on `orchid-light` | 6.55 |
| `warning` on `peach` | 7.67 |
| `coral-dark` on `peach` | 6.48 |
| `cactus` on `sage` | 6.34 |

### Interface components (minimum 3:1)

| Element | Ratio |
|---|---|
| `line-strong` on `ivory` (input border) | 4.32 |
| `line-strong` on `surface` | 4.65 |
| `violet-bright` on `ivory` (large ornaments) | 4.04 |
| `ivory` icon on `platform-instagram` | 5.59 |
| `ivory` icon on `platform-facebook` | 5.92 |
| `ivory` icon on `platform-linkedin` | 6.07 |
| `ivory` icon on `platform-youtube` | 5.76 |
| `ivory` icon on `platform-pinterest` | 6.50 |

### Platform marks

Channel circles (`PlatformMark`) use the `platform-*` tokens, the recognisable color of each network, only as the fill behind an `ivory` icon. TikTok and X use `ink`, Threads `ink-soft`, Email `violet`, Blog `cactus` and Other `line-strong`. They are never used for text.

### Usage rules derived from the table

- `coral`, `orchid` and `violet-bright` are **fill and ornament** colors. Text on `coral` and `orchid` is `ink`. Never use these three as text color on a light background.
- Links on tinted backgrounds (`peach`, `rose`, `orchid-light`) use `violet-deep`, not `violet`.
- Error and alert text uses `danger` or `coral-dark`, never `coral`.
- Text on `violet` is `ivory`.
- Focus rings use `violet` with a 2 px offset in `ivory`, so they stay visible on every surface.
- Input, checkbox and outlined-button borders use `line-strong`; `line` is for decoration only.
- Disabled elements keep at least 4.5:1 for their text, and are also marked by a "disabled" appearance beyond color (opacity is not enough on its own).

### Review of 2026-10-19

The first palette used a peach sidebar, a pink page and a plum input border: three warm, saturated surfaces that blurred together and competed with the violet of the brand. Decision: **cool, quiet neutrals for the structure and the warm colors only for emphasis**. The page (`ivory`) is a soft lilac neutral, cards (`surface`) are lighter than the page, the sidebar uses `surface` with a `line` border (the active item is `orchid-light` with `ink`), and the input border is the calmer `line-strong`. `peach`, `rose`, `coral` and `sage` keep their values and their role in statuses, badges and ornaments. Every ratio below was recomputed with the same formula; 40 rows changed.

## 6. Decorative gradient (public site only)

The reference image uses a gradient from peach through pink to lilac, with patches in violet and coral. It exists only as a **decorative token of the public site**, always built from the tokens above; the back office and the portal use flat colors.

```css
--gradient-hero: linear-gradient(135deg, var(--peach) 0%, var(--rose) 45%, var(--orchid-light) 75%, var(--orchid) 100%);
```

Organic patches are section illustrations using `coral` and `violet-bright`. Text over the gradient is `ink`, always on a label of `orchid-light` (as in the image) or on the part of the gradient that keeps at least 7:1.

## 7. Tokens for `src/styles.css`

```css
:root {
  --ink: #14245c;
  --ink-soft: #2f3a75;
  --violet: #5b33b0;
  --violet-deep: #43238a;
  --violet-bright: #8b5ce6;
  --orchid: #d9a8ee;
  --orchid-light: #ebe1fa;
  --rose: #f9c4d2;
  --peach: #fddccb;
  --coral: #ff9a7c;
  --coral-dark: #8f2a17;
  --sage: #dce8da;
  --cactus: #2f5a2b;

  --ivory: #f7f4fb;
  --surface: #fffdfe;
  --cream: #f2eef8;
  --line: #e2daea;
  --line-strong: #7a6e90;

  --warning: #5e3c00;
  --danger: #9b1c14;

  --background: var(--ivory);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--violet);
  --primary-foreground: var(--ivory);
  --secondary: var(--orchid-light);
  --secondary-foreground: var(--ink);
  --muted: var(--cream);
  --muted-foreground: var(--ink-soft);
  --accent: var(--orchid-light);
  --accent-foreground: var(--ink);
  --destructive: var(--danger);
  --destructive-foreground: var(--ivory);
  --border: var(--line);
  --input: var(--line-strong);
  --ring: var(--violet);

  --sidebar: var(--surface);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--violet);
  --sidebar-primary-foreground: var(--ivory);
  --sidebar-accent: var(--orchid-light);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: var(--line);
  --sidebar-ring: var(--violet);

  --platform-instagram: #b02a78;
  --platform-facebook: #1559c4;
  --platform-linkedin: #0a5ea8;
  --platform-youtube: #c40000;
  --platform-pinterest: #b3081a;

  --success: var(--cactus);
  --info: var(--ink-soft);

  --radius: 0.75rem;
}

@theme inline {
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-violet: var(--violet);
  --color-violet-deep: var(--violet-deep);
  --color-violet-bright: var(--violet-bright);
  --color-orchid: var(--orchid);
  --color-orchid-light: var(--orchid-light);
  --color-rose: var(--rose);
  --color-peach: var(--peach);
  --color-coral: var(--coral);
  --color-coral-dark: var(--coral-dark);
  --color-sage: var(--sage);
  --color-cactus: var(--cactus);
  --color-ivory: var(--ivory);
  --color-surface: var(--surface);
  --color-cream: var(--cream);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-success: var(--success);
  --color-info: var(--info);
  --color-platform-instagram: var(--platform-instagram);
  --color-platform-facebook: var(--platform-facebook);
  --color-platform-linkedin: var(--platform-linkedin);
  --color-platform-youtube: var(--platform-youtube);
  --color-platform-pinterest: var(--platform-pinterest);
}
```

The names `--background`, `--primary`, `--border` and so on are the ones shadcn/ui expects, so the kit copied from Memoria Print works without changing the components; only `styles.css` changes. Note that `--input` points to `line-strong` (interactive border) while `--border` stays on the decorative `line`.

## 8. Typography (suggestion to confirm)

The image uses a high-contrast editorial serif (it looks like the Cormorant family). Proposal: headings in **Cormorant Garamond** (weight 600 to 700; use 20 px or larger for headings, because Cormorant has a small x-height) and body text in a legible sans-serif (**DM Sans** or **Inter**, 16 px minimum), loaded through `<link>` in `__root.tsx`, never through a remote `@import`. Confirm the font with the brand material.

## 9. Pending validation

- Compare the hex values with the brand's original file (the ones from the image were estimated visually).
- Test dark mode only if it is decided (outside the MVP).
- Re-run the contrast check whenever a token changes (the script used for the numbers above computes WCAG 2.1 relative luminance).
