import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { FileText, Upload, X } from "lucide-react";
import {
  Page, Card, Button, Field, Textarea, ChoiceGroup, Alert, Checkbox, Chip, ICON,
} from "../../design-system";
import { api, prefs, ApiError } from "../../api/client";
import { track, EVENTS } from "../../services/analytics";
import { ProcessingState } from "./ProcessingState";
import "./AnalyzePage.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Analyse — four inputs, one screen, no wizard.
 *
 * Text extraction runs here rather than on the server, so an unreadable
 * PDF is caught before a request is sent and costs nothing. The tier
 * and experience controls are pre-filled from onboarding but never
 * hidden: they are the India-specific differentiators, and burying them
 * makes the thing that distinguishes the product invisible.
 */

const TIERS = ["Startup", "MNC", "PSU", "Government"];
const EXPERIENCE = [
  { value: "fresher", label: "Fresher" },
  { value: "1-2", label: "1–2 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5+", label: "5+ years" },
];

const MIN_RESUME = 20;
const MIN_JD = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = [".pdf", ".txt", ".md", ".doc", ".docx"];

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((i) => i.str).join(" "));
  }
  return pages.join("\n\n").trim();
}

export default function AnalyzePage() {
  const navigate = useNavigate();
  const saved = prefs.get();
  const fileInput = useRef(null);

  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdText, setJdText] = useState("");
  const [tier, setTier] = useState(saved.tier ?? "Startup");
  const [experience, setExperience] = useState(saved.experience ?? "1-2");
  const [fresherOverride, setFresherOverride] = useState(null);

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [jdTouched, setJdTouched] = useState(false);

  const fresherMode = fresherOverride ?? experience === "fresher";
  const jdTooShort = jdTouched && jdText.trim().length > 0 && jdText.trim().length < MIN_JD;
  const canSubmit = resumeText.trim().length >= MIN_RESUME && jdText.trim().length >= MIN_RESUME;

  async function ingest(file) {
    if (!file) return;
    setFileError("");

    if (file.size > MAX_FILE_BYTES) {
      setFileError("That file is larger than 5 MB. Resumes are usually well under 1 MB.");
      return;
    }
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED.includes(ext)) {
      setFileError("We can read PDF, DOCX and TXT.");
      return;
    }

    setFileName(file.name);

    if (ext === ".pdf") {
      try {
        const text = await extractPdfText(file);
        if (text.length < MIN_RESUME) {
          setFileError("We could not find any text in that PDF — it looks like a scan. Paste your resume text instead.");
          setShowPaste(true);
          return;
        }
        setResumeText(text);
        track(EVENTS.resume_uploaded, { kind: "pdf", chars: text.length });
      } catch {
        setFileError("We could not read that PDF. Paste your resume text instead.");
        setShowPaste(true);
      }
      return;
    }

    if (ext === ".doc" || ext === ".docx") {
      // No .docx parser is bundled; saying so beats failing silently.
      setFileError("We cannot read Word files in the browser yet. Export to PDF, or paste the text.");
      setShowPaste(true);
      return;
    }

    const text = await file.text();
    setResumeText(text);
    track(EVENTS.resume_uploaded, { kind: "text", chars: text.length });
  }

  function clearFile() {
    setFileName("");
    setResumeText("");
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    track(EVENTS.scan_started, { tier, experience, fresherMode });
    track(EVENTS.jd_submitted, { chars: jdText.trim().length });

    try {
      const scan = await api.createScan({ resumeText, jdText, tier, fresherMode });
      track(EVENTS.scan_completed, { scanId: scan.id, score: scan.score?.generic });
      navigate(`/report/${scan.id}`, { replace: true });
    } catch (err) {
      track(EVENTS.scan_failed, { message: err.message });
      setError(
        err instanceof ApiError && err.status === 429
          ? { title: "You have reached your analysis limit", body: "Your free analyses reset at the start of next month." }
          : { title: "We could not finish the analysis", body: err.message },
      );
      setSubmitting(false);
    }
  }

  if (submitting) return <ProcessingState role={null} />;

  return (
    <Page
      width="wide"
      title="Analyse a job"
      subtitle="Your resume against one specific posting — that is the only comparison that predicts an interview."
    >
      <form onSubmit={handleSubmit} className="analyze">
        <div className="analyze__inputs">
          {/* ---------- resume ---------- */}
          <Card pad="lg" className="analyze__col">
            <div className="ds-label">1 · Your resume</div>

            {fileName && !fileError ? (
              <div className="analyze__file">
                <FileText size={ICON.md} strokeWidth={ICON.stroke} />
                <div className="analyze__file-meta">
                  <div className="ds-body-sm">{fileName}</div>
                  <div className="ds-caption">{resumeText.trim().split(/\s+/).length} words read</div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFile} iconLeft={<X size={ICON.sm} strokeWidth={ICON.stroke} />}>
                  Remove
                </Button>
              </div>
            ) : (
              <div
                className={`analyze__drop${dragging ? " is-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); ingest(e.dataTransfer.files?.[0]); }}
              >
                <Upload size={ICON.lg} strokeWidth={ICON.stroke} />
                <div className="ds-body-sm">Drop your resume here</div>
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                  Choose a file
                </Button>
                <div className="ds-caption">PDF or TXT · up to 5 MB</div>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  className="ds-sr-only"
                  onChange={(e) => ingest(e.target.files?.[0])}
                />
              </div>
            )}

            {fileError ? (
              <Alert tone="warn" title="Could not read that file">{fileError}</Alert>
            ) : null}

            {/* Visible whenever no file has been read. It must NOT depend on
                resumeText being empty — that unmounts the field the moment
                the user types their first character into it. */}
            {(showPaste || !fileName) ? (
              <Field label="Or paste your resume">
                {(a) => (
                  <Textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste the full text of your resume…"
                    rows={8}
                    {...a}
                  />
                )}
              </Field>
            ) : null}
          </Card>

          {/* ---------- job description ---------- */}
          <Card pad="lg" className="analyze__col">
            <div className="ds-label">2 · Job description</div>
            <Field
              hint={jdText.trim().length ? `${jdText.trim().length} characters` : undefined}
              error={jdTooShort ? "That looks like a job title, not a description. Paste the full posting, including the requirements." : undefined}
            >
              {(a) => (
                <Textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  onBlur={() => setJdTouched(true)}
                  placeholder="Paste the full posting — responsibilities and requirements included."
                  rows={14}
                  {...a}
                />
              )}
            </Field>
          </Card>
        </div>

        {/* ---------- targeting ---------- */}
        <Card pad="lg">
          <div className="analyze__targeting">
            <ChoiceGroup label="3 · Company type" name="tier" value={tier} onChange={setTier} options={TIERS} />
            <ChoiceGroup
              label="4 · Experience"
              name="experience"
              value={experience}
              onChange={(v) => { setExperience(v); setFresherOverride(null); }}
              options={EXPERIENCE}
            />
          </div>
          <div className="analyze__fresher">
            <Checkbox
              label="Fresher mode"
              description="Score projects and certifications instead of penalising missing years"
              checked={fresherMode}
              onChange={(e) => setFresherOverride(e.target.checked)}
            />
          </div>
          <p className="ds-caption analyze__targeting-note">
            These change the scoring, not just the wording — a PSU is screened differently from a startup.
          </p>
        </Card>

        {error ? (
          <Alert tone="critical" title={error.title}>
            {error.body}
            <div className="ds-caption" style={{ marginTop: 6, color: "var(--good)" }}>
              Your resume is safe and no credit has been used.
            </div>
          </Alert>
        ) : null}

        {/* ---------- submit ---------- */}
        <div className="analyze__submit">
          <Button type="submit" size="lg" disabled={!canSubmit}>Analyse my resume</Button>
          <div className="ds-caption">
            {canSubmit
              ? <>About 30 seconds · <Chip tone="muted">{tier}</Chip> <Chip tone="muted">{fresherMode ? "Fresher" : experience}</Chip></>
              : "Add your resume and the job description to continue."}
          </div>
        </div>
      </form>
    </Page>
  );
}
