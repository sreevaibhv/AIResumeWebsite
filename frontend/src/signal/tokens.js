/* ============================================================
   PARSE// — "Signal" design tokens (Master Plan §6.2)
   Extracted from the original ATSScanReport.jsx prototype so every
   screen shares one source of truth instead of redefining T locally.
   ============================================================ */
export const T = {
  paper: "#F7F8F9",
  surface: "#FFFFFF",
  ink: "#0E1116",
  inkMid: "#3D4650",
  inkMute: "#79838F",
  rule: "#E2E6EA",
  ruleSoft: "#EDF0F2",
  accent: "#3A2BD9",
  accentWash: "#EEECFC",
  weak: "#C4382A",
  weakWash: "#FBEDEB",
  mid: "#B07103",
  midWash: "#FCF4E6",
  good: "#12735A",
  goodWash: "#E9F4F1",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
};

export const scoreColor = (n) => (n < 55 ? T.weak : n < 75 ? T.mid : T.good);
export const scoreWash = (n) => (n < 55 ? T.weakWash : n < 75 ? T.midWash : T.goodWash);

/**
 * Retained for the screens that still inject it. The reset, focus ring
 * and reduced-motion guard now live in design-system/base.css, and the
 * fonts are self-hosted via @fontsource — the Google Fonts @import that
 * used to be here failed silently whenever the CDN was unreachable,
 * leaving the app on system fonts with no visible signal.
 *
 * Phase 4 migrates these screens onto the design system; this constant
 * goes away with them.
 */
export const globalStyleSheet = "";
