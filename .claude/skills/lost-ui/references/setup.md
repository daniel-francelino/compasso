# Setup of an app

## Install

Apps install the package under the short name `lost-ui`, so every import reads `lost-ui/...`:

```bash
npm i "lost-ui@npm:@danielsoaresf/lost-ui"
```

`package.json` then has `"lost-ui": "npm:@danielsoaresf/lost-ui@^x.y.z"`. Never run a plain `npm i lost-ui` (another package). If the app's `package.json` has the scoped name `@danielsoaresf/lost-ui` instead, use that name in every import below.

## Styles

```css
@import "tailwindcss";
@import "lost-ui/styles.css"; /* token mapping, no brand values */
@import "lost-ui/effects.css"; /* only with lost-ui/effects */
@import "lost-ui/theme-neutral.css"; /* optional default values; leave out when the app defines the tokens */
```

- `lost-ui/styles.css` declares `@source "../dist"` itself, so Tailwind sees the classes of the library.
- The app defines the **values** of the tokens: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--info` (each with `-foreground`), `--border`, `--input`, `--ring`, `--radius`, `--header-height`, `--container-width`, plus `--effect-from`/`--effect-to` and `--rainbow-1…5` when using effects. Fonts: `--font-sans`, `--font-display`.
- Dark mode is the `.dark` class on an ancestor.

## Wrap the app once

```tsx
import { App } from "lost-ui/app/app"; // needs sonner

<App language={lang}>{/* router outlet */}</App>;
```

`App` joins the language provider, the tooltip provider and the `Toaster`. Without it: `LostI18nProvider` from `lost-ui/i18n` plus one `<Toaster />` from `lost-ui/ui/sonner`.

## Peers

Required: `react`, `react-dom`, `tailwindcss`, `tw-animate-css`, `motion`. Optional, installed only when the component that needs it is imported:

| Peer                                             | Needed by                             |
| ------------------------------------------------ | ------------------------------------- |
| `react-day-picker`                               | `Calendar`, `FormInputDate`           |
| `input-otp`                                      | `InputOTP`, `FormPinInput`            |
| `libphonenumber-js`, `country-flag-icons`        | `FormInputPhone`, `FormCountrySelect` |
| `emoji-picker-react`                             | `FormEmojiPicker`                     |
| `sonner`                                         | `Toaster`, `toast`, `App`             |
| `cmdk`, `vaul`                                   | `Command`, `Drawer`                   |
| `recharts`                                       | everything in `lost-ui/charts`        |
| `@tiptap/*`                                      | everything in `lost-ui/editor`        |
| `react-hook-form`                                | the shadcn `Form` primitive           |
| `react-resizable-panels`, `embla-carousel-react` | `Resizable`, `Carousel`               |

The effects that need `cobe`, `shiki`, `react-tweet`… are listed in the library's `docs/effects-inventory.md`.

## Import paths

- **One import:** `lost-ui` exports every component that needs no optional peer of its own, the templates and `i18n`: `import { Button, EventCalendar, LoginPage } from "lost-ui"`. `lost-ui/components` is the components alone, `lost-ui/templates` the pages alone.
- **Not in it** (their own entries, because they need peers for the whole layer): `lost-ui/charts` (recharts) and `lost-ui/editor` (Tiptap).
- Layer entry, for a leaner import: `lost-ui/ui`, `/elements`, `/app`, `/forms`, `/data`, `/ai-chat`, `/calendar`, `/effects`, `/templates`, `/i18n`.
- One component: `lost-ui/<layer>/<folder>`, e.g. `lost-ui/forms/form-input`. A template adds its category: `lost-ui/templates/auth/login-page`.
- By path only (they need a peer): `lost-ui/forms/{form-input-date,form-pin-input,form-input-phone,form-country-select,form-emoji-picker,form-builder}`, `lost-ui/ui/{calendar,carousel,command,drawer,form,input-otp,resizable,sonner}`, `lost-ui/app/app`.
- `lost-ui/lib/cn` exports `cn`.
