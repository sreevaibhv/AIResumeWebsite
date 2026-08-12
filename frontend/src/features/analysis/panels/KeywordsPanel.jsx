import React from "react";
import { Card, Chip, ProgressBar, SourceBadge, PriorityBadge, Alert } from "../../../design-system";

/**
 * Keywords — what they asked for, and what you actually had.
 *
 * The gap between exact and semantic matching is the teaching moment:
 * a low exact score with a high semantic score means a human would see
 * the match and a parser would not. That sentence is the panel's whole
 * reason to exist.
 *
 * Missing requirements show a *real* point impact — see keywordImpact()
 * in reportData.js. It is the deterministic keyword-coverage gain, so it
 * carries a LOCAL badge; the roadmap's larger, model-estimated figure is
 * shown separately and badged MODEL.
 */

const STATE_TONE = { exact: "good", semantic: "warn", partial: "warn", missing: "critical" };
const STATE_LABEL = { exact: "Exact", semantic: "Semantic", partial: "Partial", missing: "Missing" };

export function KeywordsPanel({ data }) {
  const { keywords } = data;
  const spread = data.semanticMatch - data.exactMatch;

  return (
    <div className="report__stack">
      {/* ---------- exact vs semantic ---------- */}
      <Card pad="lg">
        <div className="ds-label">Match type</div>
        <div className="keywords__match">
          <ProgressBar
            label="Exact keyword match"
            value={data.exactMatch}
            valueLabel={`${data.exactMatch}%`}
            tone="ink-mid"
          />
          <ProgressBar
            label="Semantic match"
            value={data.semanticMatch}
            valueLabel={`${data.semanticMatch}%`}
            tone="accent"
          />
        </div>
        <p className="ds-body-sm keywords__explain">
          {spread >= 15
            ? "A person reading your resume would see more of the match than a parser does. Naukri scores closer to exact matching, so the words themselves matter — not just the meaning."
            : spread <= -15
              ? "Your resume uses the posting's words, but the underlying experience matches less closely than the vocabulary suggests."
              : "Your literal wording and your underlying experience line up closely."}
        </p>
      </Card>

      {/* ---------- requirement ledger ---------- */}
      <Card pad="none">
        <div className="keywords__head">
          <div>
            <div className="ds-label">Requirement ledger</div>
            <span className="ds-caption">
              {keywords.found.length} of {keywords.totalJdSkills} requirements found
            </span>
          </div>
          {keywords.perKeywordImpact > 0 ? (
            <Chip tone="muted">
              Each missing requirement ≈ {keywords.perKeywordImpact.toFixed(1)} points
            </Chip>
          ) : null}
        </div>

        <div className="ds-scroll-x">
          <table className="keywords__table">
            <caption className="ds-sr-only">Job requirements and how your resume matched each one</caption>
            <thead>
              <tr>
                <th scope="col">They asked for</th>
                <th scope="col">Your resume</th>
                <th scope="col">Match</th>
                <th scope="col">Impact</th>
              </tr>
            </thead>
            <tbody>
              {keywords.requirements.map((r) => (
                <tr key={`${r.term}-${r.state}`} className={r.state === "missing" ? "is-missing" : undefined}>
                  <th scope="row" className="keywords__term">{r.term}</th>
                  <td className="keywords__evidence">
                    {r.evidence ?? <span className="ds-ink-mute">Not found</span>}
                    {r.state === "missing" && r.where ? (
                      <span className="ds-caption keywords__where">Add to: {r.where}</span>
                    ) : null}
                  </td>
                  <td>
                    <Chip tone={STATE_TONE[r.state]}>
                      {STATE_LABEL[r.state]}
                      {r.confidence != null && r.state !== "exact" ? ` ${r.confidence.toFixed(2)}` : ""}
                    </Chip>
                  </td>
                  <td className="keywords__impact">
                    {r.state === "missing" ? (
                      <span className="keywords__impact-inner">
                        <span className="ds-data ds-good">+{r.impact.toFixed(1)}</span>
                        <SourceBadge source="code" />
                      </span>
                    ) : (
                      <span className="ds-ink-mute ds-data">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="keywords__foot">
          <Alert tone="info" title="Why these numbers are exact">
            Keyword coverage is worth a fixed share of your score, spread evenly across the
            {" "}{keywords.totalJdSkills} requirements in this posting. Adding one moves the score by
            {" "}{keywords.perKeywordImpact.toFixed(1)} — that is arithmetic, not an estimate. Naming a
            skill may also improve your semantic match and bullet quality, and those knock-on gains
            are what the larger figures on the Fixes tab account for.
          </Alert>
        </div>
      </Card>

      {/* ---------- priorities ---------- */}
      {keywords.missing.length ? (
        <Card pad="lg">
          <div className="ds-label">Missing, by priority</div>
          <ul className="keywords__missing">
            {keywords.missing.map((m) => (
              <li key={m.term}>
                <span className="keywords__missing-term">{m.term}</span>
                <PriorityBadge priority={m.priority} />
                <span className="ds-caption">{m.where}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ---------- overused ---------- */}
      {keywords.overused.length ? (
        <Card pad="lg">
          <div className="ds-label">Weak openers you repeat</div>
          <p className="ds-body-sm" style={{ color: "var(--ink-mid)", margin: "8px 0 12px" }}>
            These start a bullet without saying what you did. Replacing them is free score.
          </p>
          <div className="keywords__chips">
            {keywords.overused.map((o) => (
              <Chip key={o.term} tone="warn">“{o.term}” × {o.n}</Chip>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ---------- responsibilities ---------- */}
      {keywords.missingResponsibilities.length ? (
        <Card pad="lg">
          <div className="ds-label">Responsibilities with no evidence</div>
          <ul className="keywords__resp">
            {keywords.missingResponsibilities.map((r, i) => <li key={i} className="ds-body-sm">{r}</li>)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
