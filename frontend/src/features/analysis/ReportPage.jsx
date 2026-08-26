import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Page, Chip, Button, Tabs, TabPanel, ErrorState, SkeletonCard, SkeletonRing, Card, useToast,
} from "../../design-system";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { api } from "../../api/client";
import { track, EVENTS } from "../../services/analytics";
import { mapScanToReport } from "./reportData";
import { OverviewPanel } from "./panels/OverviewPanel";
import { ScorePanel } from "./panels/ScorePanel";
import { KeywordsPanel } from "./panels/KeywordsPanel";
import { QualityPanel } from "./panels/QualityPanel";
import { FixesPanel } from "./panels/FixesPanel";
import { PrepPanel } from "./panels/PrepPanel";
import "./Report.css";

/**
 * The report — one route, one fetch, six panels.
 *
 * Two changes from the prototype that matter:
 *
 *  - It opens on **Overview**, not Score. A user arriving here has not
 *    asked "how is this calculated"; they have asked "how did I do and
 *    what do I do now".
 *  - It is no longer capped at 480px. The old screen rendered a phone
 *    column in the middle of a 1440px desktop.
 *
 * On a phone the tabs are dropped entirely and the panels stack in
 * decision order, so the fixes are never hidden behind a tap.
 */

const TAB_ORDER = ["overview", "score", "keywords", "quality", "fixes", "prep"];

export default function ReportPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isMobile = useIsMobile();

  const [scan, setScan] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return TAB_ORDER.includes(hash) ? hash : "overview";
  });

  useEffect(() => {
    let live = true;
    api.getScan(scanId)
      .then((s) => {
        if (!live) return;
        setScan(s);
        track(EVENTS.report_viewed, { scanId, score: s.score?.generic });
      })
      .catch((err) => live && setError(err));
    return () => { live = false; };
  }, [scanId]);

  // Tab lives in the URL so a shared link opens on the panel the sender
  // was looking at.
  function selectTab(next) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const data = useMemo(() => (scan ? mapScanToReport(scan) : null), [scan]);

  if (error) {
    const notFound = error.status === 404;
    return (
      <Page width="narrow">
        <ErrorState
          title={notFound ? "That analysis link has expired" : "We could not load this analysis"}
          description={notFound
            ? "The link may be wrong, or the analysis may have been deleted."
            : error.message}
          reassurance="Nothing has happened to your resume."
          action={<Button onClick={() => navigate("/app/analyze")}>Analyse a job</Button>}
          secondaryAction={<Button variant="ghost" onClick={() => navigate("/app")}>Back to dashboard</Button>}
        />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page width="wide">
        <div aria-busy="true" aria-live="polite">
          <span className="ds-sr-only">Loading your analysis</span>
          <Card pad="lg">
            <div className="overview__rings">
              <SkeletonRing /><SkeletonRing /><SkeletonRing />
            </div>
          </Card>
          <div style={{ height: "var(--s-4)" }} />
          <div className="overview__split">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </Page>
    );
  }

  if (data.status === "FAILED") {
    return (
      <Page width="narrow">
        <ErrorState
          title="We could not finish this analysis"
          description="Something went wrong while comparing your resume with the job description."
          reassurance="Your resume is safe and your credit has not been used."
          action={<Button onClick={() => navigate("/app/analyze")}>Try again</Button>}
        />
      </Page>
    );
  }

  const goToFixes = () => {
    selectTab("fixes");
    document.getElementById("main-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const unlock = () => {
    track(EVENTS.upgrade_clicked, { scanId, from: tab });
    toast.info("Plans are not live yet", { description: "Credit gating arrives with monetisation." });
  };

  // spec §2.2 — persists the confirmation, then merges the recomputed
  // verdict (and the confirmations themselves, for the tick state) back
  // into the local scan so mapScanToReport reflects it immediately.
  async function handleConfirm(dto) {
    const verdict = await api.confirmScan(scanId, dto);
    setScan((prev) => ({ ...prev, verdict, confirmedSkills: dto }));
    track(EVENTS.keywords_confirmed, { scanId, count: dto.skills?.length ?? 0 });
  }

  // spec §7 — interview prep is generated on demand, from either the Prep
  // tab or the Fixes tab's on-demand button; both call this so the Prep
  // tab and hasPrep flag update together regardless of which fired it.
  async function handleGeneratePrep() {
    const prep = await api.generateInterviewPrep(scanId);
    setScan((prev) => ({ ...prev, interviewPreps: [...(prev.interviewPreps ?? []), prep] }));
  }

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "score", label: "Score" },
    { key: "keywords", label: "Keywords", count: data.keywords.missing.length || undefined },
    { key: "quality", label: "Quality" },
    { key: "fixes", label: "Fixes", count: data.roadmap.length || undefined },
    { key: "prep", label: "Prep" },
  ];

  const panels = {
    overview: <OverviewPanel data={data} onFix={goToFixes} onSeeAll={unlock} onConfirm={handleConfirm} />,
    score: <ScorePanel data={data} />,
    keywords: <KeywordsPanel data={data} />,
    quality: <QualityPanel data={data} onImprove={goToFixes} />,
    fixes: <FixesPanel data={data} onUnlock={unlock} onGeneratePrep={handleGeneratePrep} />,
    prep: <PrepPanel data={data} onGenerate={handleGeneratePrep} />,
  };

  return (
    <Page width="wide">
      {/* ---------- header ---------- */}
      <header className="report__header">
        <div className="report__identity">
          <h1 className="ds-h1">{data.role}</h1>
          <div className="report__meta">
            {data.company ? <span className="ds-body-sm">{data.company}</span> : null}
            <Chip tone="muted">{data.tier}</Chip>
            {data.fresherMode ? <Chip tone="muted">Fresher mode</Chip> : null}
            {data.isOptimized ? <Chip tone="good">Optimised</Chip> : null}
          </div>
        </div>
      </header>

      {/* On a phone, tabs would hide the fixes behind a tap. The panels
          stack in decision order instead: score → problems → fixes. */}
      {isMobile ? (
        <div className="report__stack">
          {panels.overview}
          <details className="report__accordion">
            <summary className="ds-h3">Score breakdown</summary>
            {panels.score}
          </details>
          <details className="report__accordion">
            <summary className="ds-h3">Keywords</summary>
            {panels.keywords}
          </details>
          <details className="report__accordion">
            <summary className="ds-h3">Resume quality</summary>
            {panels.quality}
          </details>
          <details className="report__accordion" open>
            <summary className="ds-h3">All fixes</summary>
            {panels.fixes}
          </details>
          <details className="report__accordion">
            <summary className="ds-h3">Interview prep</summary>
            {panels.prep}
          </details>
        </div>
      ) : (
        <>
          <Tabs tabs={tabs} value={tab} onChange={selectTab} idPrefix="report" />
          {Object.entries(panels).map(([key, node]) => (
            <TabPanel key={key} tabKey={key} value={tab} idPrefix="report">{node}</TabPanel>
          ))}
        </>
      )}
    </Page>
  );
}
