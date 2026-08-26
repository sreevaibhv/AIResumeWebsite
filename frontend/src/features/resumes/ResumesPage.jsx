import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Download, Trash2 } from "lucide-react";
import {
  Page, Card, Button, Chip, Select, EmptyState, ErrorState, SkeletonCard, scoreColor, ICON,
} from "../../design-system";
import { api, download } from "../../api/client";
import { TEMPLATE_OPTIONS } from "../analysis/templateOptions";
import "./ResumesPage.css";

/**
 * My Resumes — spec §6.3. Flat, standalone, labelled by job — no lineage,
 * no grouping. Every save is its own row; the sidebar entry for this
 * route already existed (disabled) in AppShell before this build.
 */

function when(iso) {
  if (!iso) return "—";
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ResumeRow({ resume, onDeleted }) {
  const [template, setTemplate] = useState("ats-clean");
  const [format, setFormat] = useState("pdf");
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await download(`/resumes/${resume.id}/export?template=${template}&format=${format}`, `${resume.label}.${format}`);
    } catch (err) {
      setError(err.message ?? "Could not generate that file.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteResume(resume.id);
      onDeleted(resume.id);
    } catch (err) {
      setDeleting(false);
      setError(err.message ?? "Could not delete this resume.");
    }
  }

  return (
    <Card pad="md">
      <div className="resumes__row">
        <div className="resumes__rowmain">
          <div className="ds-h3">{resume.label}</div>
          <div className="ds-caption">
            {[resume.role, resume.company].filter(Boolean).join(" · ") || "—"} · {when(resume.createdAt)}
          </div>
        </div>

        {resume.score != null ? (
          <div className="ds-score-sm" style={{ color: scoreColor(resume.score) }}>{resume.score}</div>
        ) : <Chip tone="muted">No score</Chip>}

        <div className="resumes__actions">
          <Select value={template} onChange={(e) => setTemplate(e.target.value)} className="resumes__select">
            {TEMPLATE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select value={format} onChange={(e) => setFormat(e.target.value)} className="resumes__select">
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            loading={downloading}
            iconLeft={<Download size={ICON.sm} strokeWidth={ICON.stroke} />}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            iconLeft={<Trash2 size={ICON.sm} strokeWidth={ICON.stroke} />}
          >
            Delete
          </Button>
        </div>
      </div>
      {error ? <p className="ds-caption" style={{ color: "var(--critical)", marginTop: 8 }}>{error}</p> : null}
    </Card>
  );
}

export default function ResumesPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.listResumes()
      .then((list) => live && setResumes(list))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, []);

  function handleDeleted(id) {
    setResumes((prev) => prev.filter((r) => r.id !== id));
  }

  if (error) {
    return (
      <Page title="My Resumes">
        <ErrorState
          title="We could not load your saved resumes"
          description={error}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Page>
    );
  }

  if (!resumes) {
    return (
      <Page title="My Resumes">
        <div aria-busy="true" aria-live="polite">
          <span className="ds-sr-only">Loading your saved resumes</span>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      </Page>
    );
  }

  if (resumes.length === 0) {
    return (
      <Page title="My Resumes">
        <EmptyState
          icon={<FileText size={ICON.xl} strokeWidth={ICON.stroke} />}
          title="Nothing saved yet"
          description="Improve a resume against a job and save the version worth keeping — it lands here, labelled by role and company."
          action={<Button onClick={() => navigate("/app/analyze")}>Analyse a job</Button>}
        />
      </Page>
    );
  }

  return (
    <Page title="My Resumes">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {resumes.map((r) => <ResumeRow key={r.id} resume={r} onDeleted={handleDeleted} />)}
      </div>
    </Page>
  );
}
