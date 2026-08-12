import React from "react";
import { Card, ProgressBar, SourceBadge, ScoreRing } from "../../../design-system";

/**
 * Score — why is it that number?
 *
 * Every row shows what it earned, what it lost, the backend's own
 * reason, and whether that reason came from arithmetic or a model.
 * `earned` and `max` come straight from ScoreCategory, so "points lost"
 * is `max − earned` rather than a second opinion.
 */
export function ScorePanel({ data }) {
  const totalEarned = data.categories.reduce((a, c) => a + c.earned, 0);
  const totalMax = data.categories.reduce((a, c) => a + c.max, 0);

  return (
    <div className="report__stack">
      <Card pad="lg">
        <div className="score__summary">
          <ScoreRing value={data.generic} label="Match" size={120} />
          <div className="score__summary-text">
            <div className="ds-label">Where the score came from</div>
            <div className="ds-h2" style={{ marginTop: 4 }}>
              {totalEarned} <span style={{ color: "var(--ink-mute)" }}>/ {totalMax}</span>
            </div>
            <p className="ds-body-sm" style={{ color: "var(--ink-mid)", marginTop: 8 }}>
              Five weighted categories. Two are computed from your resume directly; two are the
              model's judgement; the split is marked on every row.
            </p>
          </div>
        </div>
      </Card>

      <Card pad="none">
        <div className="ds-scroll-x">
          <table className="score__table">
            <caption className="ds-sr-only">Score breakdown by category</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Earned</th>
                <th scope="col">Lost</th>
                <th scope="col">Why</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => {
                const lost = c.max - c.earned;
                return (
                  <tr key={c.key}>
                    <th scope="row">
                      <div className="score__cat">{c.key}</div>
                      <ProgressBar value={c.earned} max={c.max} className="score__bar" />
                    </th>
                    <td className="ds-data score__num">{c.earned} / {c.max}</td>
                    <td className="ds-data score__num">
                      {lost > 0 ? <span className="ds-critical">−{lost}</span> : <span className="ds-ink-mute">—</span>}
                    </td>
                    <td className="score__reason">{c.reason}</td>
                    <td><SourceBadge source={c.source} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card pad="lg">
        <div className="ds-label">What the badges mean</div>
        <div className="score__legend">
          <div>
            <SourceBadge source="code" />
            <p className="ds-body-sm">
              Measured from your resume by code. Same input, same number, every time — no model
              was asked.
            </p>
          </div>
          <div>
            <SourceBadge source="llm" />
            <p className="ds-body-sm">
              A model's judgement. Useful, but an estimate: two runs can differ, which is why it is
              labelled rather than blended in silently.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
