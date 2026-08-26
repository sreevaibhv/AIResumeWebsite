import React from "react";
import { Alert, SourceBadge } from "../../../../design-system";

export const VERDICT_META = {
  APPLY: { tone: "good", label: "Apply" },
  BORDERLINE: { tone: "warn", label: "Borderline" },
  DONT_APPLY: { tone: "critical", label: "Not yet" },
};

/**
 * VerdictBanner — spec §3. Every number here is server-computed arithmetic
 * (ScoreAggregator + achievable-ceiling.ts); this component only presents
 * it. Copy stays diagnosis, never promise: "competitive range," never
 * "you'll get the interview."
 *
 * Shared between OverviewPanel (the scan's own verdict) and EditPanel (a
 * freshly recomputed verdict after a saved edit) — one implementation.
 */
export function VerdictBanner({ verdict }) {
  if (!verdict) return null;
  const meta = VERDICT_META[verdict.verdict] ?? VERDICT_META.BORDERLINE;
  const { low, high } = verdict.projectedBand ?? {};

  return (
    <Alert tone={meta.tone} title={`${meta.label} — ${verdict.currentScore} → ${verdict.projectedScore}${low != null ? ` (${low}–${high})` : ""}`}>
      <ul className="verdict-reasons">
        {verdict.reasons.map((r, i) => (
          <li key={i} className={`verdict-reasons__item verdict-reasons__item--${r.type}`}>
            <span className="ds-body-sm">{r.text}</span>
            <SourceBadge source={r.source === "LOCAL" ? "code" : "llm"} />
          </li>
        ))}
      </ul>
    </Alert>
  );
}
