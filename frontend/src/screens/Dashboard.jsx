import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, ArrowRight, FileSearch } from "lucide-react";
import {
  Page, Section, Grid, Card, Chip, Button, EmptyState, ErrorState,
  SkeletonCard, scoreColor, scoreLabel, ICON,
} from "../design-system";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { track, EVENTS } from "../services/analytics";

/**
 * Dashboard — answers "what do I do next?" before any statistic.
 *
 * Reads GET /scans (BE-1). The previous localStorage scan index is
 * gone: it could only ever see scans made in one browser, and it went
 * stale the moment a user switched device.
 *
 * Counters are limited to what the system actually knows. There is no
 * Application model and the product never observes an interview
 * happening, so applications and interviews are not counted here.
 */

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function when(iso) {
  if (!iso) return "—";
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const TIER_LABEL = { STARTUP: "Startup", MNC: "MNC", PSU: "PSU", GOVERNMENT: "Government" };

function Stat({ label, value, note, color }) {
  return (
    <Card>
      <div className="ds-label">{label}</div>
      <div className="ds-score-md" style={{ color: color ?? "var(--ink)", margin: "6px 0 2px" }}>{value}</div>
      <div className="ds-caption">{note}</div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scans, setScans] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.listScans()
      .then((list) => live && setScans(list))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, []);

  const ready = Array.isArray(scans);
  const best = ready && scans.length ? Math.max(...scans.map((s) => s.score?.generic ?? 0)) : null;
  const bestScan = ready && scans.length ? scans.find((s) => (s.score?.generic ?? 0) === best) : null;
  const optimizedCount = ready ? scans.filter((s) => s.optimized).length : 0;
  const prepCount = ready ? scans.filter((s) => s.hasPrep).length : 0;

  // The most recent scan that still has unaddressed fixes.
  const nextUp = ready ? scans.find((s) => !s.optimized && s.roadmapCount > 0) : null;

  const newAnalysis = (
    <Button onClick={() => navigate("/app/analyze")} iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>
      Analyse new job
    </Button>
  );

  if (error) {
    return (
      <Page title={`${greeting()}, ${user?.name ?? "there"}`}>
        <ErrorState
          title="We could not load your analyses"
          description={error}
          reassurance="Your scans are stored on our servers and are not affected."
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Page>
    );
  }

  if (!ready) {
    return (
      <Page title={`${greeting()}, ${user?.name ?? "there"}`}>
        <div aria-busy="true" aria-live="polite">
          <span className="ds-sr-only">Loading your analyses</span>
          <Grid min={200}>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}</Grid>
        </div>
      </Page>
    );
  }

  if (scans.length === 0) {
    return (
      <Page title={`${greeting()}, ${user?.name ?? "there"}`}>
        <EmptyState
          icon={<FileSearch size={ICON.xl} strokeWidth={ICON.stroke} />}
          title="Analyse your first job"
          description="Paste a job description and your resume, and we will show you exactly which requirements you miss and what each one is costing you."
          /* Not "Analyse new job" here — there is no previous one to be new against. */
          action={<Button onClick={() => navigate("/app/analyze")}>Analyse a job</Button>}
        />
      </Page>
    );
  }

  return (
    <Page title={`${greeting()}, ${user?.name ?? "there"}`} actions={newAnalysis}>
      {/* ---- next step: the answer to "what now?", above any statistic ---- */}
      <Card tone="accent" pad="lg">
        <div className="dash__next">
          <div>
            <div className="ds-label" style={{ color: "var(--accent)" }}>Next step</div>
            <div className="ds-body" style={{ marginTop: 4 }}>
              {nextUp ? (
                <>
                  <strong>{nextUp.role ?? "Untitled role"}</strong>
                  {nextUp.company ? ` at ${nextUp.company}` : ""} — {nextUp.roadmapCount} fixes waiting
                  {nextUp.roadmapGain > 0 ? `, worth about +${nextUp.roadmapGain}` : ""}
                </>
              ) : (
                "Everything is optimised. Ready for another opportunity?"
              )}
            </div>
          </div>
          <Button
            onClick={() => (nextUp ? navigate(`/report/${nextUp.id}`) : navigate("/app/analyze"))}
            iconRight={<ArrowRight size={ICON.sm} strokeWidth={ICON.stroke} />}
          >
            {nextUp ? "Open report" : "Analyse a job"}
          </Button>
        </div>
      </Card>

      {/* ---- counters ---- */}
      <Grid min={180}>
        <Stat
          label="Best match" value={best ?? "—"}
          color={best != null ? scoreColor(best) : undefined}
          note={bestScan?.role ?? "—"}
        />
        <Stat label="Analyses" value={scans.length} note={scans.length === 1 ? "scan saved" : "scans saved"} />
        <Stat label="Optimised" value={optimizedCount} note={optimizedCount ? "verified rewrites" : "none yet"} />
        <Stat label="Prep sets" value={prepCount} note={prepCount ? "ready to practise" : "unlock by optimising"} />
      </Grid>

      {/* ---- recent ---- */}
      <Section
        title="Recent analyses"
        actions={<Link to="/app/analyze" className="ds-data" style={{ color: "var(--accent)" }}>+ Analyse new job</Link>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {scans.map((s) => {
            const score = s.score?.generic ?? 0;
            return (
              <Card
                key={s.id}
                interactive
                pad="md"
                onClick={() => { track(EVENTS.report_viewed, { scanId: s.id, from: "dashboard" }); navigate(`/report/${s.id}`); }}
              >
                <div className="dash__row">
                  <div className="dash__rowmain">
                    <div className="ds-h3">{s.role ?? "Untitled role"}</div>
                    <div className="ds-caption">
                      {s.company ?? "—"} · {TIER_LABEL[s.tier] ?? s.tier}
                    </div>
                  </div>
                  <div className="ds-score-sm dash__score" style={{ color: scoreColor(score) }}>
                    {score}
                    <span className="ds-sr-only"> out of 100 — {scoreLabel(score)}</span>
                  </div>
                  <div>
                    {s.optimized
                      ? <Chip tone="good">Optimised</Chip>
                      : <Chip tone="accent">{s.roadmapCount} fixes</Chip>}
                  </div>
                  <div className="ds-data dash__when">{when(s.createdAt)}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
