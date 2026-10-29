# Audit: landing page performance

Snapshot of 2026-10-29 · Scope: the home `/` (landing page of Rayana Vasconcelos, [../spaces/cms-site.md](../spaces/cms-site.md) section 18) · Method: production headers and bundle sizes of `https://rayanavasconcelos.vercel.app/` with `curl`; local production build analysed by walking the static imports of the `(site)` chunk; frame rate measured with Playwright (Chromium headless, software rendering, dev server) by counting `requestAnimationFrame` ticks over 2 to 3 seconds while disabling one suspect at a time.

Reported symptom: the page loads slowly and janks ("lento e travando").

## 1. Summary

| Requirement | Status | Evidence |
|---|---|---|
| Idle animation keeps the main thread free (60 fps) | ✅ after fixes (was ❌ at about 28 fps) | F1, F2 |
| Hero paints without a compositing storm | ✅ after fixes | F1, F2, F3 |
| Initial JavaScript is proportionate to the page | 🟡 | F4, F7 |
| HTML can be served from the CDN edge | 🟡 (header set, not verified on Vercel) | F5 |
| Below-the-fold work is deferred | ✅ after fixes | F6 |
| Motion respects the system setting | ✅ after fixes | F8 |

## 2. What is right (keep)

- Effects are imported by path (`lost-ui/effects/<name>`), never from the barrel, so unused effects are not bundled.
- Fonts use `preconnect` and `display=swap`.
- Marquee, meteors, shimmer and gradient text are CSS animations (compositor friendly).
- Scroll reveals use `useInView` (IntersectionObserver), not scroll listeners.

## 3. Findings

### F1 · High · `DotPattern glow` in the hero: about 3,500 animated SVG circles

- Evidence: the effect renders one `motion.circle` per 16 px cell of the container and animates opacity and scale of each with JavaScript (`dot-pattern.js`). On a 1280 x 700 hero that is roughly 3,500 animations on every frame.
- Risk: constant main-thread work; the cause of the "travando".
- Recommendation: a static CSS dot background with a radial mask. Done.

### F2 · High · `backdrop-blur` on the hero card (and the sticky header)

- Evidence: with all `backdrop-filter` disabled the idle frame rate went from 41 to 61 fps; hiding the hero card alone gave the same gain. A backdrop filter over a gradient that has moving content under it is re-rasterised every frame.
- Recommendation: solid `surface` background on the card and on the header. Done.

### F3 · Medium · Marquee repaints text across the full width

- Evidence: disabling the marquee animation gave about 5 fps in the same test.
- Recommendation: `contain-paint` on its section and `repeat={3}` instead of 4. Done.

### F4 · Medium · Initial JavaScript is about 290 KB gzip over about 49 static chunks

- Evidence: the largest chunk is the shared `index-*.js` (about 132 KB gzip: router, start, query and the i18n provider of the root route), then React (43 KB). The landing's own code is about 17 KB gzip plus `motion`.
- Risk: slow first load on mobile networks; mostly shared with the back office, so it is not fixed by landing changes.
- Recommendation: (a) below-the-fold blocks are `lazy` chunks (done); (b) later, check whether the public routes need `QueryClientProvider`, `UnsavedChangesProvider` and the full i18n catalogue in the root, or whether a lighter root for the `(site)` group is possible. Not done: it changes the root route and needs its own change.

### F5 · Medium · The HTML was rendered by the function on every request

- Evidence: `Cache-Control: public, max-age=0, must-revalidate`, `X-Vercel-Cache: MISS`, time to first byte about 0.69 s from Paris to a function in `iad1`.
- Recommendation: the landing has no per-user data, so the route now sends `public, s-maxage=300, stale-while-revalidate=3600`. Vercel purges its cache on each deployment. Also review the function region (set it near the database and the audience).

### F6 · Medium · Heavy effects ran from the first paint

- Evidence: meteors, the border beam and the scroll-driven text reveal were mounted at load although they are far below the fold.
- Recommendation: `MountOnView` mounts the purely decorative effects (meteors, border beam) only when within 300 px of the viewport; text and sections stay in the server HTML (search engines and anchors keep working). Sections below the fold are lazy chunks inside one `Suspense`. Done.

### F7 · Low · Several simultaneous `filter: blur` entrances

- Evidence: `BlurFade` and `TextAnimate blurInUp` animate `filter` on many elements.
- Recommendation: section titles now use `slideUp` (no filter); the hero keeps the blur because it plays once. Done.

### F8 · Low · No reduced motion for JavaScript animations

- Evidence: the global CSS rule covers CSS animations only.
- Recommendation: `MotionConfig reducedMotion="user"` around the landing. Done.

## 4. Plan

1. ✅ Remove `DotPattern glow` and the backdrop blurs (F1, F2).
2. ✅ Marquee containment (F3).
3. ✅ Lazy blocks, `MountOnView`, cheaper titles, `MotionConfig` (F6, F7, F8).
4. ✅ Cache header on the route (F5).
5. ⏳ Verify the header and the time to first byte on Vercel; choose the function region (F5).
6. ⏳ Lighter root for the public group (F4).
7. ⏳ Images (when added): `<img>` with `width`, `height`, `loading="lazy"`, `decoding="async"`, and `fetchpriority="high"` only for the hero image.

## 5. Status of each finding

| Finding | Status |
|---|---|
| F1 | fixed (uncommitted) |
| F2 | fixed (uncommitted) |
| F3 | fixed (uncommitted) |
| F4 | open (part a done, part b open) |
| F5 | header done, not verified on Vercel; region open |
| F6 | fixed (uncommitted) |
| F7 | fixed (uncommitted) |
| F8 | fixed (uncommitted) |

## 6. Limits of this audit

Frame rates come from headless Chromium with software rendering on a development machine: they show the relative cost of each suspect, not the numbers a phone will see. The production build could not be served locally (the Vercel preset has no local preview), so the sizes come from the build output and the headers from the deployed site as it was before these fixes. No Lighthouse or real-device run was made.
