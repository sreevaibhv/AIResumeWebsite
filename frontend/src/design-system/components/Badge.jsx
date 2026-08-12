import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Calculator, Lock } from "lucide-react";

/**
 * Badges — the product's trust vocabulary.
 *
 * These four components are how PARSE// "shows its working". They are
 * deliberately in the design system rather than in a page, because the
 * whole product depends on them meaning exactly one thing everywhere.
 */

/** Generic badge. Prefer one of the specific badges below. */
export function Badge({ children, tone = "neutral", icon = null, className = "" }) {
  return (
    <span className={["ds-badge", `ds-badge--${tone}`, className].filter(Boolean).join(" ")}>
      {icon ? <span className="ds-badge__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * SourceBadge — did this number come from arithmetic or from a model?
 * Maps `ScoreCategory.source`, which the backend sets per category.
 */
export function SourceBadge({ source, className = "" }) {
  const isCode = source === "code";
  return (
    <span
      className={["ds-badge", isCode ? "ds-badge--local" : "ds-badge--model", className].filter(Boolean).join(" ")}
      title={isCode
        ? "Computed locally — same input, same number, every time"
        : "Judged by a model — an estimate, not a measurement"}
    >
      <span className="ds-badge__icon" aria-hidden="true">
        {isCode ? <Calculator size={11} /> : <Cpu size={11} />}
      </span>
      {isCode ? "LOCAL" : "MODEL"}
    </span>
  );
}

/**
 * PriorityBadge — how badly a missing requirement hurts.
 * Maps `missingKeywords[].priority`.
 */
const PRIORITY = {
  critical:  { tone: "critical", label: "Critical" },
  important: { tone: "warn",     label: "Important" },
  nice:      { tone: "neutral",  label: "Nice to have" },
};

export function PriorityBadge({ priority = "nice", className = "" }) {
  const meta = PRIORITY[priority] ?? PRIORITY.nice;
  return (
    <span className={["ds-badge", `ds-badge--${meta.tone}`, className].filter(Boolean).join(" ")}>
      {meta.label}
    </span>
  );
}

/**
 * VerificationBadge — the state of an AI-written claim.
 *
 * `verified` and `failed` come from the backend's VerifyAgent.
 * `unconfirmed` is a UI state: the rewrite passed verification but
 * introduced a factual claim the user has not yet confirmed. Those two
 * must never be conflated — "traceable to the original" is a weaker
 * guarantee than "true".
 */
const VERIFICATION = {
  verified:    { tone: "good",     label: "Verified",       Icon: ShieldCheck },
  unconfirmed: { tone: "warn",     label: "Verify this",    Icon: AlertTriangle },
  failed:      { tone: "critical", label: "Not published",  Icon: ShieldAlert },
};

export function VerificationBadge({ state = "verified", className = "" }) {
  const meta = VERIFICATION[state] ?? VERIFICATION.verified;
  const { Icon } = meta;
  return (
    <span className={["ds-badge", `ds-badge--${meta.tone}`, className].filter(Boolean).join(" ")}>
      <span className="ds-badge__icon" aria-hidden="true"><Icon size={11} /></span>
      {meta.label}
    </span>
  );
}

/**
 * ConfidenceMark — how sure the model is about a roadmap item.
 * Maps `RoadmapItem.conf`. Rendered as three bars plus the word, so it
 * survives both a screenshot and a screen reader.
 */
const CONF_LEVEL = { high: 3, medium: 2, low: 1 };

export function ConfidenceMark({ conf = "medium", showLabel = true, className = "" }) {
  const level = CONF_LEVEL[conf] ?? 2;
  return (
    <span
      className={["ds-conf", `ds-conf--${conf}`, className].filter(Boolean).join(" ")}
      title={`${conf} confidence`}
    >
      <span className="ds-conf__bars" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`ds-conf__bar${i <= level ? " is-on" : ""}`} />
        ))}
      </span>
      {showLabel ? <span className="ds-conf__label">{conf}</span> : null}
      <span className="ds-sr-only">{conf} confidence</span>
    </span>
  );
}

/**
 * LockedBlock — a paywalled section that shows the shape of what is
 * behind it. Never a blurred rectangle: the count and the value are
 * real numbers from the roadmap.
 */
export function LockedBlock({ count, valueHint, children, onUnlock, className = "" }) {
  return (
    <div className={["ds-locked", className].filter(Boolean).join(" ")}>
      <div className="ds-locked__head">
        <span className="ds-badge ds-badge--neutral">
          <span className="ds-badge__icon" aria-hidden="true"><Lock size={11} /></span>
          Locked
        </span>
        <span className="ds-locked__summary">
          {count} more {count === 1 ? "fix" : "fixes"}
          {valueHint ? `, worth about ${valueHint}` : ""}
        </span>
      </div>
      {children ? <div className="ds-locked__preview">{children}</div> : null}
      {onUnlock ? (
        <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" onClick={onUnlock}>
          Unlock all fixes
        </button>
      ) : null}
    </div>
  );
}
