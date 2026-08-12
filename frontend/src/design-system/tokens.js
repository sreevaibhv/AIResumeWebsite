/* ============================================================
   JS mirror of tokens.css.

   CSS is the source of truth for anything the browser can style.
   This file exists for the cases it cannot cover: values passed to
   SVG attributes, media queries evaluated in JS, and score→colour
   logic. Keep it in sync with tokens.css.
   ============================================================ */

export const color = {
  accent: "#3A2BD9",
  accentHover: "#2E21B0",
  accentWash: "#EEECFC",
  accentOn: "#FFFFFF",

  paper: "#F7F8F9",
  surface: "#FFFFFF",
  surface2: "#FBFCFD",
  rule: "#E2E6EA",
  ruleSoft: "#EDF0F2",

  ink: "#0E1116",
  inkMid: "#3D4650",
  inkMute: "#79838F",
  inkDisabled: "#AEB6BE",

  good: "#12735A",
  goodWash: "#E9F4F1",
  warn: "#B07103",
  warnWash: "#FCF4E6",
  critical: "#C4382A",
  criticalWash: "#FBEDEB",
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 };

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 };

export const font = {
  sans: '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

/** Must match the media queries in tokens.css and base.css. */
export const breakpoint = { sm: 640, md: 768, lg: 1024, xl: 1280 };

export const duration = { fast: 120, base: 200, slow: 400 };

/* ---------- score semantics ----------
   The single place a score becomes a colour. Thresholds are the
   product's, not the design system's: <55 critical, <75 warning.  */

export const SCORE_THRESHOLD = { critical: 55, warn: 75 };

export function scoreTone(n) {
  if (n < SCORE_THRESHOLD.critical) return "critical";
  if (n < SCORE_THRESHOLD.warn) return "warn";
  return "good";
}

export function scoreColor(n) {
  return color[scoreTone(n)];
}

export function scoreWash(n) {
  return { critical: color.criticalWash, warn: color.warnWash, good: color.goodWash }[scoreTone(n)];
}

/**
 * Plain-language verdict for a score. Screen readers announce this
 * alongside the number, so the meaning never depends on ring colour
 * alone (WCAG 1.4.1).
 */
export function scoreLabel(n) {
  return { critical: "Weak match", warn: "Partial match", good: "Strong match" }[scoreTone(n)];
}
