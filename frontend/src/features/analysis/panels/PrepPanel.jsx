import React, { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Card, Button, EmptyState, ICON } from "../../../design-system";

/**
 * Prep — spec §7. Generated from the scan's stored resume+JD on demand;
 * no longer gated behind an improve. `onGenerate` is owned by ReportPage
 * so a generation triggered from here or from the Fixes tab's on-demand
 * button updates the same source of truth.
 */
function QuestionList({ items }) {
  return (
    <ul className="prep__list">
      {items.map((q, i) => (
        <li key={i} className="prep__item">
          <div className="ds-body">{q.question}</div>
          <p className="ds-caption prep__why">{q.why}</p>
        </li>
      ))}
    </ul>
  );
}

export function PrepPanel({ data, onGenerate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      await onGenerate();
    } catch (err) {
      setError(err.message ?? "Could not generate interview prep.");
    } finally {
      setLoading(false);
    }
  }

  if (!data.prep) {
    return (
      <Card pad="lg">
        <EmptyState
          icon={<MessagesSquare size={ICON.lg} strokeWidth={ICON.stroke} />}
          title="No interview prep yet"
          description="Generated from your resume and this JD — a handful of technical questions probing your actual claims, plus HR questions anticipating any gaps."
          action={<Button onClick={handleGenerate} loading={loading}>Generate interview prep</Button>}
        />
        {error ? <p className="ds-caption" style={{ color: "var(--critical)", marginTop: 8 }}>{error}</p> : null}
      </Card>
    );
  }

  return (
    <div className="report__stack">
      <Card pad="lg">
        <div className="ds-label">Technical</div>
        <QuestionList items={data.prep.technical} />
      </Card>
      <Card pad="lg">
        <div className="ds-label">HR / behavioral</div>
        <QuestionList items={data.prep.hr} />
      </Card>
    </div>
  );
}
