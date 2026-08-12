import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Card, Button, ProgressBar, ScoreRing, Chip, SourceBadge, ICON,
} from "../../../design-system";

/**
 * Quality — is the writing any good, independent of this job?
 *
 * Separate from the match score on purpose: a resume can match a
 * posting perfectly and still read badly, and the fix for each is
 * different. Weak bullets are shown as the original text with the
 * model's reasons underneath — a code-review view, not a rewrite. The
 * rewrite is the paid step, and it lives in the optimize flow.
 */
export function QualityPanel({ data, onImprove }) {
  const { quality } = data;

  return (
    <div className="report__stack">
      <Card pad="lg">
        <div className="score__summary">
          {quality.score != null ? <ScoreRing value={quality.score} label="Quality" size={120} /> : null}
          <div className="score__summary-text">
            <div className="ds-label">Resume quality</div>
            <p className="ds-body-sm" style={{ color: "var(--ink-mid)", marginTop: 8 }}>
              {quality.summaryNote || "How your resume reads on its own terms — structure, specificity and evidence — regardless of this particular job."}
            </p>
            <div style={{ marginTop: 10 }}><SourceBadge source="llm" /></div>
          </div>
        </div>
      </Card>

      {quality.sections.length ? (
        <Card pad="lg">
          <div className="ds-label">By section</div>
          <div className="quality__sections">
            {quality.sections.map((s) => (
              <div key={s.name} className="quality__section">
                <ProgressBar label={s.name} value={s.score} valueLabel={String(s.score)} />
                {s.note ? <p className="ds-caption quality__note">{s.note}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {quality.weakBullets.length ? (
        <Card pad="lg">
          <div className="quality__head">
            <div>
              <div className="ds-label">Weak bullets</div>
              <span className="ds-caption">
                {quality.weakBullets.length} of your bullets say what you touched, not what changed
              </span>
            </div>
            <Chip tone="warn">{quality.weakBullets.length} flagged</Chip>
          </div>

          <div className="quality__bullets">
            {quality.weakBullets.map((b, i) => (
              <article key={i} className="bulletcard">
                <div className="bulletcard__original">
                  <div className="ds-label">Original</div>
                  <p className="bulletcard__text">“{b.text}”</p>
                </div>

                <div className="bulletcard__why">
                  <div className="ds-label">What is wrong</div>
                  <p className="ds-body-sm">
                    <AlertTriangle size={ICON.sm} strokeWidth={2} aria-hidden="true" className="bulletcard__icon" />
                    {b.why}
                  </p>
                  {b.fix ? (
                    <p className="ds-caption bulletcard__hint">Suggested direction: {b.fix}</p>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={onImprove}>Improve this bullet</Button>
                </div>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
