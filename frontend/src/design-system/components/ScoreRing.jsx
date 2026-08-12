import React from "react";
import { scoreColor, scoreLabel } from "../tokens";

/**
 * ScoreRing — the product's loudest number.
 *
 * The ring is decoration; the accessible name carries the meaning.
 * A screen reader hears "Match: 43 out of 100, weak match" rather than
 * a bare number whose severity is only encoded in a colour (WCAG 1.4.1).
 *
 * `tone="neutral"` opts out of score colouring for values that are not
 * 0–100 judgements.
 */
export function ScoreRing({
  value,
  label,
  caption,
  size = 104,
  tone,
  verdict = true,
  className = "",
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const stroke = size >= 96 ? 8 : 6;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const colour = tone === "neutral" ? "var(--ink-mute)" : scoreColor(safe);
  const spoken = `${label ? `${label}: ` : ""}${safe} out of 100${verdict && tone !== "neutral" ? `, ${scoreLabel(safe)}` : ""}`;

  return (
    <div className={["ds-ring", className].filter(Boolean).join(" ")}>
      <div className="ds-ring__figure" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={spoken}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke="var(--rule-soft)" strokeWidth={stroke}
            />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="butt"
              strokeDasharray={`${(safe / 100) * c} ${c}`}
            />
          </g>
        </svg>
        <span
          className="ds-ring__value"
          style={{ color: colour, fontSize: Math.round(size * 0.3) }}
          aria-hidden="true"
        >
          {safe}
        </span>
      </div>
      {label ? <div className="ds-label ds-ring__label">{label}</div> : null}
      {caption ? <div className="ds-caption ds-ring__caption">{caption}</div> : null}
    </div>
  );
}

/**
 * ProgressBar — a proportion with its number beside it.
 * `tone` is semantic; omit it to colour by score.
 */
export function ProgressBar({ value, max = 100, tone, label, valueLabel, className = "" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const colour = tone ? `var(--${tone})` : scoreColor(pct);

  return (
    <div className={["ds-progress", className].filter(Boolean).join(" ")}>
      {(label || valueLabel) ? (
        <div className="ds-progress__head">
          {label ? <span className="ds-progress__label">{label}</span> : null}
          {valueLabel ? <span className="ds-data">{valueLabel}</span> : null}
        </div>
      ) : null}
      <div
        className="ds-progress__track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? undefined}
      >
        <div className="ds-progress__fill" style={{ width: `${pct}%`, background: colour }} />
      </div>
    </div>
  );
}
