import React, { useState } from "react";
import { Target } from "lucide-react";
import { Card, Button, Alert, EmptyState, ICON } from "../../../design-system";

/**
 * Portal fixes — Phase D. Generated from the scan's stored resume+JD on
 * demand, same pattern as PrepPanel: `onGenerate` is owned by ReportPage
 * so a generation triggered from here (or a future Fixes-tab cross-link)
 * updates the same source of truth.
 *
 * Distinct from the "Fixes" tab: that one is the generic ranked roadmap;
 * this one is specifically about beating Naukri's parser — headline exact-
 * match, literal keyword presence, and recency of skill evidence.
 */
export function PortalPanel({ data, onGenerate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      await onGenerate();
    } catch (err) {
      setError(err.message ?? "Could not generate portal optimization advice.");
    } finally {
      setLoading(false);
    }
  }

  if (!data.portalOptimization) {
    return (
      <Card pad="lg">
        <EmptyState
          icon={<Target size={ICON.lg} strokeWidth={ICON.stroke} />}
          title="No portal fixes yet"
          description="Naukri's parser behaves differently from a generic ATS — it weights an exact headline match, literal keyword wording, and how recently a skill was used. Generate specific, copy-pasteable fixes for that."
          action={<Button onClick={handleGenerate} loading={loading}>Generate portal fixes</Button>}
        />
        {error ? <p className="ds-caption" style={{ color: "var(--critical)", marginTop: 8 }}>{error}</p> : null}
      </Card>
    );
  }

  const { headlineFix, literalTermSwaps, recencyFixes, summary } = data.portalOptimization;

  return (
    <div className="report__stack">
      <Alert tone="info" title="Highest-leverage fix">{summary}</Alert>

      <Card pad="lg">
        <div className="ds-label">Headline</div>
        {headlineFix.current === headlineFix.suggested ? (
          <p className="ds-body-sm">Your headline already matches. {headlineFix.why}</p>
        ) : (
          <>
            <div className="portal__headline">
              <span className="ds-body-sm portal__headline-current">{headlineFix.current}</span>
              <span className="ds-caption">→</span>
              <span className="ds-body portal__headline-suggested">{headlineFix.suggested}</span>
            </div>
            <p className="ds-caption portal__why">{headlineFix.why}</p>
          </>
        )}
      </Card>

      <Card pad="lg">
        <div className="ds-label">Literal keyword swaps</div>
        {literalTermSwaps.length ? (
          <ul className="portal__list">
            {literalTermSwaps.map((swap, i) => (
              <li key={i} className="portal__item">
                <div className="ds-body-sm">
                  <strong>{swap.jdTerm}</strong>
                  {swap.currentPhrase ? <> — you wrote "{swap.currentPhrase}"</> : null}
                </div>
                <p className="ds-caption">Use "{swap.suggestedPhrase}" in {swap.insertLocation}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ds-body-sm" style={{ color: "var(--ink-mute)" }}>No literal-wording gaps found.</p>
        )}
      </Card>

      <Card pad="lg">
        <div className="ds-label">Recency</div>
        {recencyFixes.length ? (
          <ul className="portal__list">
            {recencyFixes.map((fix, i) => (
              <li key={i} className="portal__item">
                <div className="ds-body-sm"><strong>{fix.skill}</strong> — currently under {fix.bestEvidenceRole}</div>
                <p className="ds-caption">{fix.recommendation}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ds-body-sm" style={{ color: "var(--ink-mute)" }}>No recency gaps found.</p>
        )}
      </Card>
    </div>
  );
}
