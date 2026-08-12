import React, { useState } from "react";
import { ShieldAlert, Sparkle } from "lucide-react";
import {
  Card, Button, Chip, Alert, ProgressBar, ConfidenceMark, LockedBlock, ICON,
} from "../../../design-system";
import { api } from "../../../api/client";
import { track, EVENTS } from "../../../services/analytics";

/**
 * Fixes — in what order, for how much.
 *
 * Two things here are deliberate:
 *
 * 1. The simulator is client-side arithmetic over the roadmap's own
 *    `gain` values (FR-19). Ticking a fix models the result; it does not
 *    call anything and does not change the resume. It projects onto the
 *    Match score because that is what the roadmap's gains are derived
 *    from — the original prototype projected onto the Naukri score,
 *    which the gains do not describe.
 *
 * 2. The rewrite action is kept minimal and preserves the existing
 *    working endpoint, including its fail-closed branch. The full
 *    change-by-change review is the optimize flow, built next.
 */
export function FixesPanel({ data, onUnlock }) {
  const [applied, setApplied] = useState({});
  const [rewriting, setRewriting] = useState(false);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [error, setError] = useState("");

  const unlocked = data.roadmap.filter((r) => !r.locked);
  const gained = unlocked.filter((r) => applied[r.rank]).reduce((a, r) => a + (r.gain ?? 0), 0);
  const projected = Math.min(100, data.generic + gained);

  async function handleRewrite() {
    setRewriting(true);
    setError("");
    setResult(null);
    setFailure(null);
    track(EVENTS.optimization_started, { scanId: data.id });

    try {
      const res = await api.rewriteScan(data.id);
      if (res.status === "verification_failed") {
        track(EVENTS.verification_failed_shown, { scanId: data.id, claims: res.flaggedClaims?.length ?? 0 });
        setFailure(res.flaggedClaims ?? []);
      } else {
        setResult(res);
        track(EVENTS.score_improved, { scanId: data.id, after: res.rescored?.score?.generic });
      }
    } catch (err) {
      setError(err.message ?? "The rewrite could not be completed.");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <div className="report__stack">
      {/* ---------- simulator ---------- */}
      <Card pad="lg" className="fixes__sim">
        <div className="ds-label">Projected match score</div>
        <div className="fixes__sim-row">
          <span className="ds-score-xl" style={{ color: gained > 0 ? "var(--good)" : "var(--ink)" }}>
            {projected}
          </span>
          {gained > 0 ? <span className="ds-score-sm ds-good">+{gained}</span> : null}
          <span className="ds-caption fixes__sim-from">from {data.generic}</span>
        </div>
        <ProgressBar value={projected} max={100} tone={gained > 0 ? "good" : undefined} />
        <p className="ds-caption fixes__sim-note">
          Tick fixes to model the result. This is arithmetic in your browser — nothing has been
          sent anywhere and your resume is unchanged.
        </p>
      </Card>

      {/* ---------- roadmap ---------- */}
      <div className="fixes__list">
        {data.roadmap.filter((r) => !r.locked).map((r) => (
          <Card key={r.rank} pad="md">
            <div className="fixes__item">
              <input
                type="checkbox"
                id={`fix-${r.rank}`}
                checked={Boolean(applied[r.rank])}
                onChange={() => setApplied((p) => ({ ...p, [r.rank]: !p[r.rank] }))}
                className="fixes__check"
              />
              <div className="fixes__body">
                <label htmlFor={`fix-${r.rank}`} className="fixes__label">
                  <span className="fixes__rank">{String(r.rank).padStart(2, "0")}</span>
                  <span className="ds-body">{r.fix}</span>
                </label>
                {r.evidence ? <p className="ds-caption fixes__evidence">{r.evidence}</p> : null}
              </div>
              <div className="fixes__gain">
                <span className="ds-data ds-good">≈ +{r.gain}</span>
                <ConfidenceMark conf={r.conf} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {data.lockedCount > 0 ? (
        <LockedBlock
          count={data.lockedCount}
          valueHint={data.lockedGain > 0 ? `+${data.lockedGain} points` : undefined}
          onUnlock={onUnlock}
        />
      ) : null}

      {/* ---------- rewrite ---------- */}
      <Card pad="lg">
        <div className="ds-label">Let AI make these changes</div>
        <p className="ds-body-sm fixes__rewrite-copy">
          We rewrite against the roadmap above, then check every claim against your original
          resume. If a claim cannot be traced back, we keep your original and tell you why.
        </p>

        {error ? <Alert tone="critical" title="The rewrite could not be completed">{error}</Alert> : null}

        {failure ? (
          <Alert
            tone="critical"
            title="We did not publish this rewrite"
            actions={<Button size="sm" variant="secondary" onClick={handleRewrite}>Try again</Button>}
          >
            <p>
              Our rewrite made claims we could not trace back to your resume, so we kept your
              original. Nothing was changed.
            </p>
            <ul className="fixes__claims">
              {failure.map((c, i) => (
                <li key={i}>
                  <ShieldAlert size={ICON.sm} strokeWidth={2} aria-hidden="true" />
                  <span><strong>“{c.claim}”</strong> — {c.reason}</span>
                </li>
              ))}
            </ul>
            <p className="ds-caption">
              If any of these are genuinely true, add them yourself and re-scan — we will score
              them properly.
            </p>
          </Alert>
        ) : null}

        {result ? (
          <Alert tone="good" title="Rewrite verified">
            <p>
              Every claim traces back to your original resume.
              {result.rescored?.score?.generic != null
                ? ` Re-scored: ${data.generic} → ${result.rescored.score.generic}.`
                : ""}
            </p>
            {result.changeSummary?.length ? (
              <ul className="fixes__changes">
                {result.changeSummary.map((c, i) => <li key={i} className="ds-body-sm">{c}</li>)}
              </ul>
            ) : null}
            <p className="ds-caption">
              A change-by-change review, where you accept or reject each edit, is the next screen
              we are building. For now nothing has replaced your original.
            </p>
          </Alert>
        ) : null}

        {!result && !failure ? (
          <Button
            onClick={handleRewrite}
            loading={rewriting}
            iconLeft={<Sparkle size={ICON.sm} strokeWidth={ICON.stroke} />}
          >
            Rewrite with AI
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
