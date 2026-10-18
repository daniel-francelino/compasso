# Compasso color palette

> Based on the site reference image (peach, pink and lilac gradient, violet and coral ornaments, navy text). Values are estimated by eye from the image and then tuned for **high contrast (WCAG AAA, 7:1, for body text on its intended surfaces)**; they can be refined with the original brand file. Tokens live in `src/styles.css`. No component uses hex values, pure black, pure white or the default Tailwind palette (enforced by ESLint).

## 1. Brand colors

| Token | Hex | Origin in the image | Role |
|---|---|---|---|
| `ink` | `#14245C` | Navy text "Marketing • Social Media" | Main text (deep navy, not black) |
| `ink-soft` | `#2F3A75` | Lighter step of the same navy | Secondary text, captions |
| `violet` | `#5B33B0` | Purple patches, bottom right | Primary color: main action, links, focus |
| `violet-deep` | `#43238A` | Deeper step of the violet | Hover and pressed state of the primary action; links on tinted backgrounds |
| `violet-bright` | `#8B5CE6` | Brightest purple of the patches | **Ornaments and large shapes only** (never text) |
| `orchid` | `#D9A8EE` | Star sparkles | Ornaments, highlights, emphasis badges |
| `orchid-light` | `#F1D3F2` | Background of the text labels | Highlight backgrounds, active menu item |
| `rose` | `#F9C4D2` | Center of the gradient | Secondary backgrounds, soft emphasis |
| `peach` | `#FDDCCB` | Top left of the gradient | Section backgrounds, sidebar |
| `coral` | `#FF9A7C` | Orange patch, top corner | Warm accent: ornaments, indicators (fill only) |
| `coral-dark` | `#8F2A17` | Coral with text-grade contrast | Text and icons for soft alerts, soft destructive action |
| `sage` | `#DCE8DA` | Grey-green, top left corner | Soft background for success and confirmations |
| `cactus` | `#2F5A2B` | Green of the phone case | Success, approved |

## 2. Warm neutrals (replace pure grey, black and white)

| Token | Hex | Role |
|---|---|---|
| `ivory` | `#FFF8F4` | Page background |
| `surface` | `#FFFCFA` | Cards, panels, popovers |
| `cream` | `#FDEBE3` | Secondary backgrounds, `muted`, alternate table rows |
| `line` | `#EBD3DC` | Decorative dividers and card borders |
| `line-strong` | `#8A5D74` | **Interactive borders** (inputs, checkboxes, outlined buttons); contrast above 3:1 as required for UI components |

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

Thresholds: AA is 4.5 for normal text; AAA is 7. UI components need 3 or more. Target of this palette: **7 or more for body text on page and card surfaces (the only exception is `cactus` on `cream`, 6.94); 6 or more for text on tinted badges**.

### Text on the main surfaces

| Text on background | Ratio |
|---|---|
| `ink` on `ivory` | 13.91 |
| `ink` on `surface` | 14.31 |
| `ink` on `cream` | 12.65 |
| `ink-soft` on `ivory` | 10.08 |
| `ink-soft` on `surface` | 10.37 |
| `ink-soft` on `cream` | 9.16 |
| `violet` on `ivory` (links) | 7.85 |
| `violet` on `surface` (links) | 8.08 |
| `violet` on `cream` (links) | 7.14 |
| `ivory` on `violet` (primary button) | 7.85 |
| `ivory` on `violet-deep` (button hover) | 10.83 |
| `ivory` on `danger` (destructive button) | 7.78 |
| `danger` on `ivory` | 7.78 |
| `danger` on `cream` | 7.07 |
| `coral-dark` on `ivory` | 7.96 |
| `coral-dark` on `cream` | 7.23 |
| `cactus` on `ivory` | 7.63 |
| `cactus` on `cream` | 6.94 |
| `warning` on `ivory` | 9.42 |
| `warning` on `cream` | 8.56 |

### Text on tinted backgrounds (badges, highlights, sidebar)

| Text on background | Ratio |
|---|---|
| `ink` on `peach` | 11.33 |
| `ink` on `orchid-light` | 10.68 |
| `ink` on `rose` | 9.64 |
| `ink` on `sage` | 11.55 |
| `ink` on `orchid` | 7.51 |
| `ink` on `coral` | 7.08 |
| `ink-soft` on `peach` | 8.21 |
| `ink-soft` on `orchid-light` | 7.74 |
| `ink-soft` on `rose` | 6.99 |
| `violet-deep` on `orchid-light` | 8.31 |
| `violet-deep` on `peach` | 8.82 |
| `violet-deep` on `rose` | 7.50 |
| `violet` on `peach` | 6.39 |
| `violet` on `orchid-light` | 6.03 |
| `warning` on `peach` | 7.67 |
| `coral-dark` on `peach` | 6.48 |
| `cactus` on `sage` | 6.34 |

### Interface components (minimum 3:1)

| Element | Ratio |
|---|---|
| `line-strong` on `ivory` (input border) | 5.13 |
| `line-strong` on `surface` | 5.27 |
| `violet-bright` on `ivory` (large ornaments) | 4.19 |

### Usage rules derived from the table

- `coral`, `orchid` and `violet-bright` are **fill and ornament** colors. Text on `coral` and `orchid` is `ink`. Never use these three as text color on a light background.
- Links on tinted backgrounds (`peach`, `rose`, `orchid-light`) use `violet-deep`, not `violet`.
- Error and alert text uses `danger` or `coral-dark`, never `coral`.
- Text on `violet` is `ivory`.
- Focus rings use `violet` with a 2 px offset in `ivory`, so they stay visible on every surface.
- Input, checkbox and outlined-button borders use `line-strong`; `line` is for decoration only.
- Disabled elements keep at least 4.5:1 for their text, and are also marked by a "disabled" appearance beyond color (opacity is not enough on its own).

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
  --orchid-light: #f1d3f2;
  --rose: #f9c4d2;
  --peach: #fddccb;
  --coral: #ff9a7c;
  --coral-dark: #8f2a17;
  --sage: #dce8da;
  --cactus: #2f5a2b;

  --ivory: #fff8f4;
  --surface: #fffcfa;
  --cream: #fdebe3;
  --line: #ebd3dc;
  --line-strong: #8a5d74;

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

  --sidebar: var(--peach);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--violet);
  --sidebar-primary-foreground: var(--ivory);
  --sidebar-accent: var(--orchid-light);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: var(--line);
  --sidebar-ring: var(--violet);

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
}
```

The names `--background`, `--primary`, `--border` and so on are the ones shadcn/ui expects, so the kit copied from Memoria Print works without changing the components; only `styles.css` changes. Note that `--input` points to `line-strong` (interactive border) while `--border` stays on the decorative `line`.

## 8. Typography (suggestion to confirm)

The image uses a high-contrast editorial serif (it looks like the Cormorant family). Proposal: headings in **Cormorant Garamond** (weight 600 to 700; use 20 px or larger for headings, because Cormorant has a small x-height) and body text in a legible sans-serif (**DM Sans** or **Inter**, 16 px minimum), loaded through `<link>` in `__root.tsx`, never through a remote `@import`. Confirm the font with the brand material.

## 9. Pending validation

- Compare the hex values with the brand's original file (the ones from the image were estimated visually).
- Test dark mode only if it is decided (outside the MVP).
- Re-run the contrast check whenever a token changes (the script used for the numbers above computes WCAG 2.1 relative luminance).
