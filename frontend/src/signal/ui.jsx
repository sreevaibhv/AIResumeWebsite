import React from "react";
import { T, scoreColor } from "./tokens";

/* ============================================================
   Signal — shared primitives. LEGACY.
   Superseded by src/design-system/; only SignIn still imports
   from here, and these retire with that screen. See README.md §10.
   ============================================================ */

export const Eyebrow = ({ children, style }) => (
  <div
    style={{
      fontFamily: T.mono,
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: T.inkMute,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card = ({ children, pad = 16, style }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.rule}`, borderRadius: 6, padding: pad, ...style }}>
    {children}
  </div>
);

const CHIP_TONES = {
  critical: { bg: T.weakWash, fg: T.weak },
  important: { bg: T.midWash, fg: T.mid },
  nice: { bg: T.surface, fg: T.inkMute },
  neutral: { bg: T.surface, fg: T.inkMid },
  good: { bg: T.goodWash, fg: T.good },
  accent: { bg: T.accentWash, fg: T.accent },
};

export const Chip = ({ children, tone = "neutral" }) => {
  const map = CHIP_TONES[tone] ?? CHIP_TONES.neutral;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        padding: "3px 7px",
        borderRadius: 4,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bg === T.surface ? T.rule : "transparent"}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

export const Button = ({ children, variant = "primary", style, ...rest }) => {
  const base = {
    fontFamily: T.mono,
    fontSize: 12,
    letterSpacing: "0.04em",
    fontWeight: 600,
    padding: "11px 16px",
    borderRadius: 5,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.55 : 1,
    width: "100%",
  };
  const variants = {
    primary: { background: T.accent, color: "#fff", border: `1px solid ${T.accent}` },
    ghost: { background: T.surface, color: T.inkMid, border: `1px solid ${T.rule}` },
    quiet: { background: "transparent", color: T.inkMute, border: "1px solid transparent", textDecoration: "underline" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
};

export const Field = ({ label, hint, children }) => (
  <label style={{ display: "block", marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {hint ? <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkMute }}>{hint}</span> : null}
    </div>
    {children}
  </label>
);

export const input = {
  width: "100%",
  fontFamily: T.sans,
  fontSize: 14,
  color: T.ink,
  padding: "10px 12px",
  borderRadius: 5,
  border: `1px solid ${T.rule}`,
  background: T.surface,
};

/* Score ring — same geometry as the report screen's. */
export const Ring = ({ value, label, size = 96, dim }) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  const col = dim ? T.inkMute : scoreColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke={T.ruleSoft} strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="butt"
            strokeDasharray={`${(value / 100) * c} ${c}`}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: T.mono, fontSize: size * 0.3, fontWeight: 600, color: col, letterSpacing: "-0.02em" }}>
            {value}
          </span>
        </div>
      </div>
      {label ? <Eyebrow style={{ color: dim ? T.inkMute : T.inkMid }}>{label}</Eyebrow> : null}
    </div>
  );
};

/** Prisma Tier enum → display label. Naive title-casing gives "Mnc"/"Psu". */
export const tierLabel = (tier) =>
  ({ STARTUP: "Startup", MNC: "MNC", PSU: "PSU", GOVERNMENT: "Government" })[tier] ?? tier ?? "—";

export const Wordmark = ({ size = 15 }) => (
  <div style={{ fontFamily: T.mono, fontSize: size, fontWeight: 600, letterSpacing: "0.18em", color: T.ink }}>
    PARSE<span style={{ color: T.accent }}>//</span>
  </div>
);
