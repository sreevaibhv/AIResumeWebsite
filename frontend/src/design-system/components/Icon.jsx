import React from "react";

/**
 * Icon sizing contract.
 *
 * Lucide components are imported directly where they are used —
 * `import { Lock } from "lucide-react"` — so the bundle only carries
 * the icons the app actually renders. What this module owns is the
 * part that must stay consistent: the size set and the stroke weight.
 *
 *   <Lock size={ICON.sm} strokeWidth={ICON.stroke} />
 *
 * Only these four sizes. An icon at 17px is a bug, not a decision.
 */
export const ICON = {
  xs: 12,   // inside badges
  sm: 14,   // inside chips and buttons
  md: 16,   // default — inline with body text
  lg: 20,   // section headers
  xl: 24,   // empty states
  stroke: 1.5,
};

/**
 * Wraps an icon that carries meaning on its own, giving it an
 * accessible name. Decorative icons need no wrapper — mark those
 * `aria-hidden` at the call site.
 */
export function IconLabel({ children, label }) {
  return (
    <>
      <span aria-hidden="true" style={{ display: "inline-flex" }}>{children}</span>
      <span className="ds-sr-only">{label}</span>
    </>
  );
}
