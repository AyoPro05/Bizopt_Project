# BizOpt Design System

Canonical source of truth for visual language, tokens, and component conventions.
All UI work must reference and extend this file rather than introducing arbitrary
colors, spacing, or typography.

---

## 1. Principles

- **Semantic tokens over literal colors.** Components consume `--color-<family>-*`
  variables, never raw Tailwind scales (`bg-emerald-50`, `text-red-700`, `bg-white`).
- **Dark-mode correctness by construction.** Every token has a `light` definition
  in `:root` and a `dark` override inside `.dark`.
- **Accessibility first.** `prefers-reduced-motion`, `focus-visible`, `aria-*`
  attributes, and sufficient color contrast are non-negotiable.
- **Composition over duplication.** Form fields, callouts, and banners must reuse
  shared primitives. No inline color classes in application pages.
- **One typography stack.** `Fraunces` for display headings, `DM Sans` for body/UI.

---

## 2. Color

### 2.1 Surfaces & ink

| Token | Light | Dark | Usage |
|-------|------|------|-------|
| `--color-surface` | `#f8fafc` | `#0f172a` | Page background |
| `--color-card` | `#ffffff` | `#1e293b` | Cards, modals |
| `--color-elevated` | `#ffffff` | `#1e293b` | Elevated surfaces |
| `--color-ink` | `#1e293b` | `#f1f5f9` | Primary text |
| `--color-ink-muted` | `#64748b` | `#94a3b8` | Secondary text |
| `--color-ink-subtle` | `#94a3b8` | `#64748b` | Tertiary text |
| `--color-border` | `#f1f5f9` | `#334155` | Faint borders |
| `--color-border-strong` | `#e2e8f0` | `#475569` | Strong borders |

> **Rule:** Replace every `bg-white`, `bg-slate-*`, and hardcoded border with the
> tokens above. `bg-white` is explicitly forbidden — it breaks dark mode.

### 2.2 Brand

| Token | Light | Dark |
|-------|------|------|
| `--color-accent` | `#0d9488` (teal-700) | `#2dd4bf` (teal-300) |
| `--color-accent-hover` | `#0f766e` | `#14b8a6` |
| `--color-accent-soft` | `#f0fdfa` | `#134e4a` |
| `--color-accent-muted` | `#ccfbf1` | `#115e59` |

### 2.3 Status families (semantic)

Each family has a background tint, foreground text, and border token. Use these
*everywhere* — not raw Tailwind scales.

| Family | Tokens (light → dark) | Use |
|--------|----------------------|-----|
| **success** | bg `#dcfce7`→`#14532d` · fg `#166534`→`#86efac` · border `#bbf7d0`→`#166534` | published, pass, trialing, positive |
| **warning** | bg `#ffedd5`→`#78350f` · fg `#78350f`→`#fcd34d` · border `#fed7aa`→`#451a03` | draft, past_due, pending, caution |
| **danger** | bg `#fee2e2`→`#7f1d1d` · fg `#7f1d1d`→`#fca5a5` · border `#fecaca`→`#450a0a` | failed, canceled, error, destructive |
| **info** | bg `#e0f2fe`→`#075985` · fg `#075985`→`#7dd3fc` · border `#7dd3fc`→`#0c4a6e` | scheduled, syncing, neutral-positive |
| **neutral** | bg `#f1f5f9`→`#1e293b` · fg `#334159`→`#94a3b8` · border `#e2e8f0`→`#334155` | disabled, muted status |

Solid status icons/tints also map to `--color-success` / `--color-warning` /
`--color-danger` / `--color-info` / `--color-warm`.

### 2.4 Status → tone mapping (Badge)

| Tone | Statuses |
|------|----------|
| success | `active`, `published`, `pass`, `trialing`, `caption`, `feature`, `image_prompt`, `thread`, `audio_idea`, `low` |
| warning | `draft`, `past_due`, `warn`, `medium`, `pending_payment` |
| danger | `failed`, `canceled`, `trial_ended`, `fail`, `high`, `security` |
| info | `scheduled`, `webhook_syncing`, `video_idea`, `improvement`, `fix` |
| neutral | (fallback for unknown) |

---

## 3. Typography

| Role | Font | Source | Notes |
|------|------|--------|-------|
| Display / headings | `Fraunces` | `--font-display-fraunces` | headings 1–3 |
| UI / body | `DM Sans` | `--font-sans-dm` | body, buttons, labels |

### Scale

- `font-display` class → Fraunces (headings, use on `h1`–`h3`).
- Body base: `text-sm` (14px), `text-xs` for captions/muted.
- Letter-spacing on headings: `-0.02em` (`tracking-tight`-ish), already applied
  globally via `h1..h4` in `globals.css`.
- `text-wrap: balance` is available via `.text-balance` utility; apply to all
  headings.
- Line height: `leading-relaxed` (1.625) for body copy.

### Micro-typography

- Use the real ellipsis character `…` (not `...`).
- Use non-breaking space `&nbsp;` between numbers and units, e.g. `10&nbsp;MB`.
- Use curly quotes in prose copy.

---

## 4. Motion & interaction

- **Respects `prefers-reduced-motion`** globally (`globals.css`); no motion for
  motion-sensitive users.
- Available utilities: `.animate-fade-in`, `.animate-slide-up`, `.animate-shimmer`,
  `.animate-pulse-subtle`, `.animate-spin-fast`.
- Standard transition: `transition-all duration-200` for interactive surfaces;
  `cubic-bezier(0.33, 0.66, 0.66, 1)` for entrance animations.
- Hover affordances: cards use `.interactive-tile`; buttons scale `active:scale-[0.98]`.
- Focus ring: `focus-visible:` outline `2px solid var(--color-accent)`, offset `2px`.

---

## 5. Elevation

| Token | Light | Dark |
|-------|------|------|
| `--shadow-card` | `0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)` | `0 1px 2px 0 rgb(0 0 0 / 0.2)…` |
| `--shadow-card-hover` | `0 4px 6px…` | darker variant |
| `--shadow-elevated` | elevated | darker |

---

## 6. Component primitives

### 6.1 Core atoms
- `Button` — `primary | secondary | ghost | danger`, `sm | md | lg`, `loading`, `ariaLabel`.
- `Input` — with `error`, `ariaDescribedBy`.
- `Card` — wraps `card-panel`.
- `Badge` — tone-mapped from `status` (see §2.4).
- `LoadingSpinner`, `Skeleton`, `EmptyState`, `Toast`.

### 6.2 Form composites
- `Label` — `<label>` wired to a field `id`; use `text-sm font-medium`.
- `Textarea` — mirrors `Input`, supports `error`, `ariaDescribedBy`, rows.
- `FieldError` — renders the inline error message (`var(--color-danger-fg)`,
  `text-xs`) linked via `aria-describedby`.
- `FormField` — `<label>` + field + `FieldError` with consistent spacing.

### 6.3 Composites
- `Callout` — `tone: success | warning | danger | info`, optional icon + action.
  Replaces all inline banner callouts.
- `Modal` (planned) — `Dialog`-based, `aria-modal`, Escape-to-close.

### 6.4 Layout
- `Sidebar` — `role="navigation"`, `aria-label="Main application navigation"`,
  active item marked with accent leading bar.
- `AppTopbar` — sticky subheader with Back-to-Home linklet.
- **Mobile:** sidebar collapses to a hamburger drawer (future P1).

---

## 7. Accessibility checklist (enforced)

- [x] `prefers-reduced-motion` respected
- [x] `focus-visible` custom focus ring on all interactive elements
- [x] `aria-label` on icon-only buttons
- [x] `aria-live="polite"` on status updates; `assertive` on errors
- [x] `aria-describedby` linking inputs to error text
- [x] Skip-to-content link in `app/(app)/layout.tsx`
- [x] Landmark roles (`navigation`) on shell; `<main id="main-content">`
- [ ] **TODO:** explicit `<header>` / `<footer>` landmarks on marketing shell
- [ ] **TODO:** heading-level auditing per page (no skipped levels)

---

## 8. Image strategy

- Prefer `next/image` (`Image`) for content images — automatic `srcset`, AVIF,
  blur placeholders.
- `SafeImage` / `FallbackImage` exist for cases needing the raw `<img>` fallback
  pattern; migrate remaining raw `<img>` usages to `next/image`.
- Always provide `alt`; decorative images use `alt=""`.
- Always set explicit `width`/`height` or `sizes` to prevent CLS.

---

## 9. Contribution

1. Before adding a color, add a token here and extend `:root` + `.dark`.
2. Before adding a banner/field pattern, build/modify a primitive in
   `components/ui/`.
3. Run `npm run lint && npx tsc --noEmit` before committing.
