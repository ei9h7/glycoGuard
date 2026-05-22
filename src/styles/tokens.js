// GlycoGuard Design Tokens
// Single source of truth for all colours, typography, spacing, and radius.
// Import this file in every component. To rebrand, update values here only.
//
// Palette: Pediatric × Zesty
// Background: near-white with pink warmth
// Accents: hot pink (brand), electric sky (data), vivid mint (success)
// Anchor: deep navy

export const colors = {
  // ── Backgrounds (60%) ──────────────────────────────────────────────────────
  bgPrimary:       '#FFFBFD',   // near-white, barely-pink — main app background
  bgSecondary:     '#FFFFFF',   // pure white — cards, modals
  bgSurface:       '#FFE8F3',   // light pink — card borders, pill backgrounds
  bgSurfaceAlt:    '#F5F8FA',   // cool light grey — neutral surfaces

  // ── Brand (30%) ────────────────────────────────────────────────────────────
  brandPink:       '#FF5DA8',   // hot pink — primary brand, logo drop half, CTAs. NEVER use for glucose readings or clinical data (see DESIGN_SYSTEM.md Rule 2)
  brandBlue:       '#00BFFF',   // electric sky — icons, chart dots, decorative UI only. Contrast ~2.7:1 on white — fails WCAG AA for text. NEVER use for clinical data (see Rule 2 & 3)
  brandGreen:      '#00D68F',   // vivid mint — success, in-range, logo mark
  brandGreenDark:  '#00916A',   // darker mint — text on light success surfaces
  anchor:          '#1A2E3B',   // deep navy — primary text, dark backgrounds, logo shield bg

  // ── Logo specific ──────────────────────────────────────────────────────────
  logoShield:      '#C8D0D8',   // silver — shield half (light mode)
  logoShieldDark:  '#D4DCE4',   // lighter silver — shield half (dark mode)
  logoShieldStroke:'#A0ACB8',   // silver stroke
  logoDropStroke:  '#E0407E',   // deep pink stroke on drop half

  // ── Borders ────────────────────────────────────────────────────────────────
  borderLight:     '#FFE8F3',   // pink-tinted border — cards on light bg
  borderMid:       '#E2C4D8',   // stronger pink border — emphasis
  borderNeutral:   '#E2E8F0',   // neutral grey border — non-pink contexts

  // ── Typography ─────────────────────────────────────────────────────────────
  textPrimary:     '#1A2E3B',   // deep navy — headings, body
  textSecondary:   '#4A5568',   // slate — secondary text
  textMuted:       '#6C757D',   // grey — hints, timestamps, labels
  textOnDark:      '#FFFFFF',   // white — text on dark backgrounds
  textOnBrand:     '#1A2E3B',   // navy — text on pink/mint buttons

  // ── Semantic — success (10%) ───────────────────────────────────────────────
  success:         '#00916A',   // text + icons on success surfaces
  successBg:       '#E0FBF2',   // success surface background
  successBorder:   '#00D68F',   // success border

  // ── Semantic — warning ─────────────────────────────────────────────────────
  warning:         '#D97706',   // text + icons on warning surfaces
  warningBg:       '#FFF8E1',   // warning surface background
  warningBorder:   '#D97706',   // warning border

  // ── Semantic — danger ──────────────────────────────────────────────────────
  danger:          '#B91C1C',   // text + icons on danger surfaces
  dangerBg:        '#FEF2F2',   // danger surface background
  dangerBorder:    '#B91C1C',   // danger border

  // ── Dark mode overrides ────────────────────────────────────────────────────
  // Usage: import { colors, colorsDark } and switch via context
  dark: {
    bgPrimary:     '#1A2E3B',
    bgSecondary:   '#243547',
    bgSurface:     '#2A3F52',
    bgSurfaceAlt:  '#1F3344',
    textPrimary:   '#FFFFFF',
    textSecondary: '#B0C4D4',
    textMuted:     '#7A9AB0',
    borderLight:   '#2A4A5E',
    borderNeutral: '#2A4A5E',
  },
};

export const typography = {
  fontDisplay: "'DM Serif Display', Georgia, serif",  // headings, numbers, logo wordmark
  fontSans:    "'DM Sans', -apple-system, sans-serif", // all UI text
  fontMono:    "'SF Mono', 'Fira Code', monospace",    // code, values

  sizeXs:   10,
  sizeSm:   12,
  sizeBase: 14,
  sizeMd:   16,
  sizeLg:   18,
  sizeXl:   22,
  size2xl:  28,
  size3xl:  36,
};

export const radius = {
  sm:   8,
  md:   10,
  lg:   14,
  xl:   16,
  xxl:  20,
  pill: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
};

export const shadows = {
  // Kept minimal — flat design, no heavy shadows
  card: '0 1px 3px rgba(26,46,59,0.06)',
  modal:'0 8px 32px rgba(26,46,59,0.12)',
};

// ── Convenience export for inline styles ──────────────────────────────────────
// Usage: import { t } from '../styles/tokens'
// Then: style={{ background: t.bg, color: t.text, borderRadius: t.r.lg }}

export const t = {
  // Backgrounds
  bg:        colors.bgPrimary,
  bgCard:    colors.bgSecondary,
  bgSurface: colors.bgSurface,

  // Text
  text:      colors.textPrimary,
  textSub:   colors.textSecondary,
  textMuted: colors.textMuted,

  // Brand — UI only. See DESIGN_SYSTEM.md Clinical Colour Rules before using these.
  pink:      colors.brandPink,  // UI/brand only — never clinical data
  blue:      colors.brandBlue,  // icons/dots only — never text on white, never clinical data
  green:     colors.brandGreen,
  greenDark: colors.brandGreenDark,
  navy:      colors.anchor,

  // Borders
  border:    colors.borderLight,

  // Semantic
  ok:        colors.success,
  okBg:      colors.successBg,
  okBorder:  colors.successBorder,
  warn:      colors.warning,
  warnBg:    colors.warningBg,
  warnBorder:colors.warningBorder,
  err:       colors.danger,
  errBg:     colors.dangerBg,
  errBorder: colors.dangerBorder,

  // Typography
  fontDisplay: typography.fontDisplay,
  fontSans:    typography.fontSans,

  // Radius shorthand
  r: {
    sm:  `${radius.sm}px`,
    md:  `${radius.md}px`,
    lg:  `${radius.lg}px`,
    xl:  `${radius.xl}px`,
    xxl: `${radius.xxl}px`,
    pill:`${radius.pill}px`,
  },

  // Spacing shorthand
  s: {
    xs:  `${spacing.xs}px`,
    sm:  `${spacing.sm}px`,
    md:  `${spacing.md}px`,
    lg:  `${spacing.lg}px`,
    xl:  `${spacing.xl}px`,
    xxl: `${spacing.xxl}px`,
  },
};

export default { colors, typography, radius, spacing, shadows, t };
