# GlycoGuard Design System

This document is the authoritative reference for all visual design decisions in GlycoGuard.
Update it whenever you add tokens, change semantic colour mappings, or establish new conventions.
All values are sourced from `src/styles/tokens.js` — that file is the single source of truth.

---

## Overview

GlycoGuard is a **mobile-first pediatric health application**. Its primary users are parents
and caregivers managing hypoglycaemia in young children — often under stress, often at night,
often one-handed. Every design decision should be evaluated against three principles:

1. **Accessibility** — readable at a glance, usable in low light, minimal cognitive load
2. **Reduced anxiety** — calm, clean layouts with no unnecessary visual noise
3. **Clinical credibility** — semantic colour and layout conventions that communicate medical
   information clearly and consistently

The colour palette follows the **60/30/10 principle**:

- **60% backgrounds** — near-white with subtle pink warmth (`bgPrimary`, `bgSecondary`, `bgSurface`)
- **30% brand accents** — hot pink, electric sky, vivid mint, anchor navy
- **10% semantic** — success, warning, and danger tokens used exclusively for clinical data

---

## Colour Palette

> All colours are defined in `src/styles/tokens.js`. **Never hardcode hex values in components.**
> Import `{ t }` for inline styles or `{ colors }` for direct access.

### Backgrounds

| `colors` key | `t` shorthand | Hex | Use |
|---|---|---|---|
| `bgPrimary` | `t.bg` | `#FFFBFD` | Main app background |
| `bgSecondary` | `t.bgCard` | `#FFFFFF` | Cards, modals |
| `bgSurface` | `t.bgSurface` | `#FFE8F3` | Pill backgrounds, input fills |
| `bgSurfaceAlt` | — | `#F5F8FA` | Neutral surfaces, non-pink contexts |

### Brand Accents

| `colors` key | `t` shorthand | Hex | Use |
|---|---|---|---|
| `brandPink` | `t.pink` | `#FF5DA8` | Primary CTAs, logo drop half, navigation active state |
| `brandBlue` | `t.blue` | `#00BFFF` | CGM data point dots, icons, graphical/decorative elements |
| `brandGreen` | `t.green` | `#00D68F` | In-range accent, logo mark — see note below |
| `brandGreenDark` | `t.greenDark` | `#00916A` | Text on light success surfaces |
| `anchor` | `t.navy` | `#1A2E3B` | Primary text, dark backgrounds, logo shield background |

> **Note on brandGreen vs. success:** `brandGreen` (`t.green`) is a brand colour — it should not be
> used to colour glucose readings. Use the semantic token `t.ok` (`#00916A`) for in-range glucose
> values. See [Clinical Colour Rules](#clinical-colour-rules) below.

### Borders

| `colors` key | Hex | Use |
|---|---|---|
| `borderLight` | `#FFE8F3` | Card borders on light backgrounds (matches `bgSurface`) |
| `borderMid` | `#E2C4D8` | Emphasis borders, focused inputs |
| `borderNeutral` | `#E2E8F0` | Borders in non-pink contexts |

### Text

| `colors` key | `t` shorthand | Hex | Use |
|---|---|---|---|
| `textPrimary` | `t.text` | `#1A2E3B` | Headings, body text |
| `textSecondary` | `t.textSub` | `#4A5568` | Secondary copy, subtitles |
| `textMuted` | `t.textMuted` | `#6C757D` | Hints, timestamps, section labels |
| `textOnDark` | — | `#FFFFFF` | Text on dark backgrounds only |
| `textOnBrand` | — | `#1A2E3B` | Text on pink/mint buttons |

### Semantic (Clinical Use Only)

These tokens encode clinical meaning and must be used consistently across all screens.
See [Clinical Colour Rules](#clinical-colour-rules) for the mandatory mapping.

| `colors` key | `t` shorthand | Hex | Use |
|---|---|---|---|
| `success` | `t.ok` | `#00916A` | In-range glucose text and icons |
| `successBg` | `t.okBg` | `#E0FBF2` | In-range surface background |
| `successBorder` | `t.okBorder` | `#00D68F` | In-range border |
| `warning` | `t.warn` | `#D97706` | Impending low / elevated glucose text |
| `warningBg` | `t.warnBg` | `#FFF8E1` | Warning surface background |
| `warningBorder` | `t.warnBorder` | `#D97706` | Warning border |
| `danger` | `t.err` | `#B91C1C` | Severe low glucose text and icons |
| `dangerBg` | `t.errBg` | `#FEF2F2` | Danger surface background |
| `dangerBorder` | `t.errBorder` | `#B91C1C` | Danger border |

### Dark Mode Overrides

Defined as `colors.dark` in `tokens.js`. Not yet implemented — see [Dark Mode](#dark-mode).

| Key | Light value | Dark override |
|---|---|---|
| `bgPrimary` | `#FFFBFD` | `#1A2E3B` |
| `bgSecondary` | `#FFFFFF` | `#243547` |
| `bgSurface` | `#FFE8F3` | `#2A3F52` |
| `bgSurfaceAlt` | `#F5F8FA` | `#1F3344` |
| `textPrimary` | `#1A2E3B` | `#FFFFFF` |
| `textSecondary` | `#4A5568` | `#B0C4D4` |
| `textMuted` | `#6C757D` | `#7A9AB0` |
| `borderLight` | `#FFE8F3` | `#2A4A5E` |
| `borderNeutral` | `#E2E8F0` | `#2A4A5E` |

---

## Clinical Colour Rules

> **These rules are safety-critical.** GlycoGuard is used by parents making real-time decisions
> about a child's blood glucose. A misread glucose value — caused by an inconsistent or confusing
> colour — could delay a response to a hypoglycaemic episode. Every contributor must follow these
> rules without exception.

### Rule 1 — Blood glucose status must always use semantic tokens, never brand colours

The glucose colour mapping is fixed and must be consistent across **every** screen that displays
a glucose value: the glucose ring, the timeline, the glucose history list, and any future screen.

| Condition | Threshold | Text token | Surface token | Border token |
|---|---|---|---|---|
| Severe low | `< 3.5 mmol/L` | `t.err` (`#B91C1C`) | `t.errBg` (`#FEF2F2`) | `t.errBorder` |
| Impending low | `< targetMin` and `≥ 3.5` | `t.warn` (`#D97706`) | `t.warnBg` (`#FFF8E1`) | `t.warnBorder` |
| In range | `targetMin` to `targetMax` | `t.ok` (`#00916A`) | `t.okBg` (`#E0FBF2`) | `t.okBorder` |
| Elevated | `> targetMax` | `t.warn` (`#D97706`) | `t.warnBg` (`#FFF8E1`) | `t.warnBorder` |

**Correct:**
```js
// The only place this mapping should live — copy from Home.jsx if adding a new screen
function glucoseColor(value, targetMin, targetMax) {
  if (value < 3.5)        return t.err;
  if (value < targetMin)  return t.warn;
  if (value > targetMax)  return t.warn;
  return t.ok;
}
```

**Incorrect:**
```js
// ❌ Never use brand colours for clinical data
color: t.pink          // brandPink is for UI only
color: t.blue          // brandBlue is for UI only
color: '#22c55e'       // hardcoded value bypasses the semantic system
color: t.green         // brandGreen is not a semantic token — use t.ok
```

If you add a new screen that displays glucose readings, copy the `glucoseColor()` helper from
`src/screens/Home.jsx` rather than inventing a new mapping.

---

### Rule 2 — Brand colours are never used for medical data

`brandPink` (`#FF5DA8`) and `brandBlue` (`#00BFFF`) are **UI-only** colours. They communicate
brand identity, navigation, and interactive affordance. They must never be applied to:

- A glucose reading or trend indicator
- A symptom severity indicator
- Any clinical alert or threshold crossing
- Any value a parent uses to make a dosing or feeding decision

A parent must be able to instantly distinguish "this is a brand colour" from "this is a
clinical alert." Mixing the two degrades that signal and introduces real risk.

**Correct:**
```js
// brandPink: navigation, buttons, logo, decorative UI
<button style={{ background: t.pink, color: t.navy }}>Log glucose</button>

// semantic tokens: clinical data only
<span style={{ color: t.err }}>2.8 mmol/L</span>
```

**Incorrect:**
```js
// ❌ Pink on a glucose reading — a parent who has learned the brand colour may not read it as danger
<span style={{ color: t.pink }}>2.8 mmol/L</span>

// ❌ Blue on a clinical value has no semantic meaning
<span style={{ color: t.blue }}>Severe low</span>
```

---

### Rule 3 — brandBlue fails WCAG AA for small text on white

`brandBlue` (`#00BFFF`) has a contrast ratio of approximately **2.7:1** against white (`#FFFFFF`).
This is below the WCAG AA minimum of **4.5:1** required for normal text (under 18pt / 14pt bold).

**Allowed uses of brandBlue:**
- Icons and SVG graphical elements
- CGM data point dots on a chart
- Decorative UI elements with no informational text

**Correct:**
```js
// Icon or data dot — no text contrast requirement applies
<svg style={{ fill: t.blue }} />

// Text on a brandBlue surface must use textPrimary, not white
<div style={{ background: t.blue, color: t.navy }}>CGM connected</div>
```

**Incorrect:**
```js
// ❌ White text on brandBlue: contrast ~2.7:1, fails WCAG AA
<div style={{ background: t.blue, color: '#FFFFFF' }}>CGM connected</div>

// ❌ brandBlue body text on a white background: also fails WCAG AA
<p style={{ color: t.blue }}>Last reading 5 minutes ago</p>
```

If you need a readable blue-tone text colour, use `colors.textSecondary` (`#4A5568`) or
`colors.anchor` (`#1A2E3B`) instead.

---

## Typography

Two typefaces only. Do not introduce a third without a deliberate decision recorded in this file.

| Token | Value | Use |
|---|---|---|
| `t.fontDisplay` | `'DM Serif Display', Georgia, serif` | Logo wordmark, large headings, glucose numbers |
| `t.fontSans` | `'DM Sans', -apple-system, sans-serif` | All UI text, labels, buttons, body copy |
| `typography.fontMono` | `'SF Mono', 'Fira Code', monospace` | Code, raw data values |

Both DM Serif Display and DM Sans are loaded via Google Fonts in `index.html`. They must stay
loaded there — do not move them to a CSS file or remove them.

### Font size scale

| Token | px | Use |
|---|---|---|
| `typography.sizeXs` | 10 | Fine print, micro labels |
| `typography.sizeSm` | 12 | Section headers, timestamps, hints |
| `typography.sizeBase` | 14 | Body text, inputs, button labels |
| `typography.sizeMd` | 16 | Slightly prominent body |
| `typography.sizeLg` | 18 | Modal titles, card headings |
| `typography.sizeXl` | 22 | Large headings |
| `typography.size2xl` | 28 | Screen titles |
| `typography.size3xl` | 36 | Glucose ring value, hero numbers |

Never use font weights above 700 for display text or above 600 for UI text. Do not set
`font-weight: 900` or use ultra-bold variants.

---

## Logo & Mark

The GlycoGuard mark is a **shield/drop hybrid**:

- **Left half — shield** (`#C8D0D8` silver): represents protection, safety, clinical reliability
- **Right half — drop** (`#FF5DA8` hot pink): represents blood glucose, the drop shape is universal shorthand for glucose management

The SVG files live in `public/`. The proportions and colours of the mark are fixed:

| Element | Colour | Token |
|---|---|---|
| Shield half fill | `#C8D0D8` | `colors.logoShield` |
| Shield half (dark mode) | `#D4DCE4` | `colors.logoShieldDark` |
| Shield stroke | `#A0ACB8` | `colors.logoShieldStroke` |
| Drop fill | `#FF5DA8` | `colors.brandPink` |
| Drop stroke | `#E0407E` | `colors.logoDropStroke` |

**Never modify** the mark proportions, colours, or stroke weights. Do not recolour either half.

### Wordmark

The wordmark is set in **DM Serif Display**:

- **"Glyco"** — `colors.anchor` (`#1A2E3B`, deep navy)
- **"Guard"** — `colors.brandPink` (`#FF5DA8`, hot pink)

The split colouring is intentional — it mirrors the shield/drop split in the mark. Do not
render the wordmark in a single colour.

---

## Spacing & Radius

All spacing and radius values come from `tokens.js` and are accessed via the `t.s` and `t.r`
shorthands respectively. Never hardcode `px` values in components.

### Spacing

| Token | `t.s` shorthand | px | Use |
|---|---|---|---|
| `spacing.xs` | `t.s.xs` | 4px | Tight internal padding, icon gaps |
| `spacing.sm` | `t.s.sm` | 8px | Between related elements |
| `spacing.md` | `t.s.md` | 12px | Standard internal padding |
| `spacing.lg` | `t.s.lg` | 16px | Section gaps, card padding |
| `spacing.xl` | `t.s.xl` | 20px | Larger section gaps |
| `spacing.xxl` | `t.s.xxl` | 24px | Screen edge padding, major sections |
| `spacing.xxxl` | — | 32px | Large layout gaps |

### Border Radius

| Token | `t.r` shorthand | px | Use |
|---|---|---|---|
| `radius.sm` | `t.r.sm` | 8px | Tight elements, tags, badges |
| `radius.md` | `t.r.md` | 10px | Buttons, inputs |
| `radius.lg` | `t.r.lg` | 14px | Standard cards |
| `radius.xl` | `t.r.xl` | 16px | Large cards |
| `radius.xxl` | `t.r.xxl` | 20px | Full-bleed modals, bottom sheets |
| `radius.pill` | `t.r.pill` | 999px | Pills, badges, rounded chips |

---

## Component Conventions

### Styles

- **All styles are inline JS objects** — no CSS files, no Tailwind, no CSS modules
- Styles live in a `const s = { ... }` or `const styles = { ... }` object at the **bottom** of
  each component file
- Always `import { t } from '../styles/tokens'` (adjust path depth for `auth/` screens) and use
  token values exclusively — never hardcode hex colours or px values

### Cards

```js
{
  background: t.bgCard,          // #FFFFFF
  border: `1px solid ${t.border}`, // #FFE8F3
  borderRadius: t.r.lg,          // 14px
  boxShadow: shadows.card,       // subtle lift
}
```

### Section Headers

```js
{
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  color: t.textMuted,            // #6C757D
  fontFamily: t.fontSans,
}
```

### Primary Buttons

```js
{
  background: t.pink,            // #FF5DA8
  color: t.navy,                 // #1A2E3B (textOnBrand)
  border: 'none',
  borderRadius: t.r.md,          // 10px
  fontWeight: 600,
  fontFamily: t.fontSans,
}
```

### Danger Buttons

```js
{
  background: t.errBg,           // #FEF2F2
  color: t.err,                  // #B91C1C
  border: `1px solid ${t.errBorder}`,
  borderRadius: t.r.md,
}
```

### Alert Banners

Three variants — each uses semantic bg + border + icon colour:

```js
// Success / in-range
{ background: t.okBg, border: `1px solid ${t.okBorder}`, color: t.ok }

// Warning / impending low / elevated
{ background: t.warnBg, border: `1px solid ${t.warnBorder}`, color: t.warn }

// Danger / severe low
{ background: t.errBg, border: `1px solid ${t.errBorder}`, color: t.err }
```

### Modals

Modals use the callback pattern — they receive `onSave(data)` and `onClose()` props. Save
logic lives in the parent screen component, not inside the modal.

```js
{
  background: t.bgCard,
  border: `1px solid ${t.border}`,
  borderRadius: t.r.xxl,
  boxShadow: shadows.modal,
  padding: 24,
}
```

---

## Accessibility

- **Minimum contrast ratio:** WCAG AA requires 4.5:1 for normal text (< 18pt) and 3:1 for
  large text (≥ 18pt) and graphical elements
- `textPrimary` (`#1A2E3B`) on `bgPrimary` (`#FFFBFD`) — contrast **≈ 14:1** ✅ exceeds AAA
- `textMuted` (`#6C757D`) on `bgPrimary` (`#FFFBFD`) — contrast **≈ 4.6:1** ✅ passes AA for body text
- **Do not use `textMuted` on `bgSurface`** (`#FFE8F3`) without checking contrast — the pink
  tint reduces the ratio and it may fail for small text
- `brandBlue` (`#00BFFF`) on white — contrast **≈ 2.7:1** ❌ fails AA — see [Rule 3](#rule-3--brandblue-fails-wcag-aa-for-small-text-on-white)
- All interactive elements (buttons, links, inputs) must have a visible `:focus` state.
  The app currently uses `outline: none` on inputs — if you add keyboard navigation or
  form accessibility, restore visible focus rings using `borderColor: t.pink` as the
  focused state indicator
- Tap targets on mobile must be at least 44×44px per Apple HIG and WCAG 2.5.5 (AAA)

---

## Dark Mode

Dark mode tokens are defined in `colors.dark` in `src/styles/tokens.js`. **Dark mode is not
yet implemented in the app** — this is a planned feature.

Contributors working on dark mode should use the `colors.dark` overrides exclusively and must
not introduce new dark-mode colour values outside of `tokens.js`. When implementing, wire the
override via a React context (e.g. `ThemeContext`) so components can switch without changing
their token references.

---

## What Not To Do

- **Never hardcode hex values.** Import `{ t }` from `src/styles/tokens.js` and use token
  references. Hardcoded values bypass the design system and break any future theming.
- **Never introduce new colours** without adding them to `tokens.js` first and documenting
  their intended use in this file.
- **Never use CSS files, Tailwind classes, or CSS modules.** All styles are inline JS objects.
- **Never modify the logo mark** — its proportions, colours, and stroke weights are fixed.
  See [Logo & Mark](#logo--mark).
- **Never use font weights above 700** for display text or above 600 for UI text.
- **Never use pure black (`#000000`) or pure white (`#FFFFFF`) for text.** Use `textPrimary`
  (`#1A2E3B`) and `textOnDark` (`#FFFFFF`) only where their specific token use is appropriate.
- **Never use `colors.brandGreen` / `t.green` to colour a glucose reading.** `brandGreen` is
  a brand colour. Use the semantic token `t.ok` (`#00916A`) for in-range glucose values.
- **Never use brandPink or brandBlue for any clinical data value.** These are UI-only colours.
  Applying them to glucose readings, symptom indicators, or clinical alerts breaks the semantic
  distinction a parent relies on. See [Rule 2](#rule-2--brand-colours-are-never-used-for-medical-data).
- **Never use white text on a brandBlue background,** and never use brandBlue for body text on
  white. The contrast ratio (~2.7:1) fails WCAG AA. See [Rule 3](#rule-3--brandblue-fails-wcag-aa-for-small-text-on-white).
- **Never invent a new glucose colour mapping in a new screen.** Copy the `glucoseColor()`
  helper from `src/screens/Home.jsx`. The mapping must be identical across all screens.
  See [Rule 1](#rule-1--blood-glucose-status-must-always-use-semantic-tokens-never-brand-colours).
