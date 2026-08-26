import React, { useState } from "react";
import { ShieldAlert, Sparkle, MessagesSquare, Send } from "lucide-react";
import {
  Card, Button, Alert, ProgressBar, ConfidenceMark, LockedBlock, ICON,
} from "../../../design-system";
import { api } from "../../../api/client";
import { track, EVENTS } from "../../../services/analytics";
import { SavePrompt } from "./shared/SavePrompt";
import { ExportControls } from "./shared/ExportControls";
import { CategoryDeltaList } from "./shared/CategoryDeltaList";

/**
 * On-demand — spec §7. Each button is its own call, made only when clicked.
 * Interview prep generation is owned by ReportPage (`onGeneratePrep`) so
 * this button and the Prep tab share the same source of truth — firing it
 * from here doesn't leave the Prep tab looking like nothing happened.
 */
function OnDemandActions({ scanId, hasPrep, onGeneratePrep }) {
  const [referral, setReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);

  async function requestReferral() {
    setReferralLoading(true);
    try {
      const res = await api.referralMessage(scanId);
      setReferral(res.message);
      track(EVENTS.referral_message_requested, { scanId });
    } finally {
      setReferralLoading(false);
    }
  }

  async function requestPrep() {
    setPrepLoading(true);
    try {
      await onGeneratePrep();
      track(EVENTS.interview_prep_requested, { scanId });
    } finally {
      setPrepLoading(false);
    }
  }

  return (
    <div className="fixes__ondemand">
      <Button
        variant="ghost"
        size="sm"
        onClick={requestPrep}
        loading={prepLoading}
        disabled={hasPrep}
        iconLeft={<MessagesSquare size={ICON.sm} strokeWidth={ICON.stroke} />}
      >
        {hasPrep ? "Interview prep ready — see the Prep tab" : "Generate interview prep"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={requestReferral}
        loading={referralLoading}
        iconLeft={<Send size={ICON.sm} strokeWidth={ICON.stroke} />}
      >
        Draft a referral message
      </Button>
      {referral ? (
        <Alert tone="info" title="Referral message">
          <p className="ds-body-sm">{referral}</p>
        </Alert>
      ) : null}
    </div>
  );
}

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
 * 2. Improve (POST /scan/:id/improve, spec §4) replaces the old rewrite
 *    endpoint. It reuses stored data — no re-scan — and preserves the
 *    fail-closed branch verbatim: a claim that can't be traced back means
 *    the original resume ships, never the unverified rewrite.
 */
export function FixesPanel({ data, onUnlock, onGeneratePrep }) {
  const [applied, setApplied] = useState({});
  const [improving, setImproving] = useState(false);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [error, setError] = useState("");

  const unlocked = data.roadmap.filter((r) => !r.locked);
  const gained = unlocked.filter((r) => applied[r.rank]).reduce((a, r) => a + (r.gain ?? 0), 0);
  const projected = Math.min(100, data.generic + gained);

  async function handleImprove() {
    setImproving(true);
    setError("");
    setResult(null);
    setFailure(null);
    track(EVENTS.improve_started, { scanId: data.id });

    try {
      const res = await api.improveScan(data.id);
      if (res.status === "verification_failed") {
        track(EVENTS.improve_verification_failed, { scanId: data.id, claims: res.flaggedClaims?.length ?? 0 });
        setFailure(res);
      } else {
        setResult(res);
        track(EVENTS.improve_verified, { scanId: data.id, after: res.afterScore });
      }
    } catch (err) {
      setError(err.message ?? "The improve pass could not be completed.");
    } finally {
      setImproving(false);
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

      {/* ---------- improve ---------- */}
      <Card pad="lg">
        <div className="ds-label">Let AI make these changes</div>
        <p className="ds-body-sm fixes__rewrite-copy">
          We insert any keywords and profile links you confirmed, then rewrite against the roadmap
          above and check every claim against your original resume. If a claim cannot be traced
          back, we keep your original and tell you why.
        </p>

        {error ? <Alert tone="critical" title="The improve pass could not be completed">{error}</Alert> : null}

        {failure ? (
          <Alert
            tone="critical"
            title="We did not publish this rewrite"
            actions={<Button size="sm" variant="secondary" onClick={handleImprove}>Try again</Button>}
          >
            <p>
              Our rewrite made claims we could not trace back to your resume, so we kept your
              original (with your confirmed keywords and links still applied). Nothing else was changed.
            </p>
            <ul className="fixes__claims">
              {failure.flaggedClaims.map((c, i) => (
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
              {result.afterScore != null ? ` Re-scored: ${result.beforeScore} → ${result.afterScore}.` : ""}
            </p>
            <CategoryDeltaList categoryDelta={result.categoryDelta} />
            {result.changeSummary?.length ? (
              <ul className="fixes__changes">
                {result.changeSummary.map((c, i) => <li key={i} className="ds-body-sm">{c}</li>)}
              </ul>
            ) : null}

            <div className="fixes__postimprove">
              <SavePrompt
                data={data}
                resumeVersionId={result.resumeVersionId}
                structuredResume={result.structuredResume}
                afterScore={result.afterScore}
              />
              <ExportControls resumeVersionId={result.resumeVersionId} scanId={data.id} />
              <OnDemandActions scanId={data.id} hasPrep={data.hasPrep} onGeneratePrep={onGeneratePrep} />
            </div>
          </Alert>
        ) : null}

        {!result && !failure ? (
          <Button
            onClick={handleImprove}
            loading={improving}
            iconLeft={<Sparkle size={ICON.sm} strokeWidth={ICON.stroke} />}
          >
            Improve with AI
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
