import React from "react";

/**
 * Chip — a compact labelled value.
 *
 * tone: neutral | accent | good | warn | critical | muted
 *
 * Tone alone never carries the meaning: pass an `icon` or make the
 * text itself explicit ("Missing", not just a red dot). See WCAG 1.4.1.
 */
export function Chip({ children, tone = "neutral", icon = null, onRemove, className = "", ...rest }) {
  return (
    <span className={["ds-chip", `ds-chip--${tone}`, className].filter(Boolean).join(" ")} {...rest}>
      {icon ? <span className="ds-chip__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ds-chip__label">{children}</span>
      {onRemove ? (
        <button type="button" className="ds-chip__remove" onClick={onRemove} aria-label={`Remove ${children}`}>
          ×
        </button>
      ) : null}
    </span>
  );
}

/**
 * KeywordChip — a JD requirement and how the resume matched it.
 *
 * state: exact | semantic | partial | missing
 * The state word is always rendered, so the match quality is legible
 * without relying on colour.
 */
const KEYWORD_STATE = {
  exact:    { tone: "good",     label: "Exact" },
  semantic: { tone: "warn",     label: "Semantic" },
  partial:  { tone: "warn",     label: "Partial" },
  missing:  { tone: "critical", label: "Missing" },
};

export function KeywordChip({ term, state = "exact", confidence, className = "" }) {
  const meta = KEYWORD_STATE[state] ?? KEYWORD_STATE.exact;
  return (
    <span className={["ds-keyword", `ds-keyword--${state}`, className].filter(Boolean).join(" ")}>
      <span className="ds-keyword__term">{term}</span>
      <span className="ds-keyword__state">
        {meta.label}
        {confidence != null ? ` ${confidence.toFixed(2)}` : ""}
      </span>
    </span>
  );
}
