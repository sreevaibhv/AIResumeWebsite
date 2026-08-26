import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as mammoth from "mammoth";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import {
  Page, Card, Button, Field, Textarea, ChoiceGroup, Alert, Checkbox, Chip, ICON,
} from "../../design-system";
import { api, prefs, ApiError, extractDocument } from "../../api/client";
import { track, EVENTS } from "../../services/analytics";
import { assessExtraction } from "./extractionQuality";
import { ProcessingState } from "./ProcessingState";
import "./AnalyzePage.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Analyse — three inputs, one screen, no wizard.
 *
 * Two-tier extraction: pdfjs runs here in the browser first (tier 1), so a
 * good PDF costs nothing and sends nothing. assessExtraction() grades the
 * result; anything short of "good" escalates to a server-side Gemini
 * multimodal read (tier 2) of the raw bytes. Either way, the extracted
 * text always lands in an editable confirm step before it's submitted —
 * that step, not the trigger, is what actually protects against a bad
 * read reaching the pipeline. The experience control is pre-filled from
 * onboarding but never hidden. Company tier is not asked here at all —
 * it's detected from the JD (TierDetectionAgent) once the scan runs.
 */

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
  return { text: pages.join("\n\n").trim(), pageCount: pdf.numPages };
}

export default function AnalyzePage() {
  const navigate = useNavigate();
  const saved = prefs.get();
  const fileInput = useRef(null);

  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdText, setJdText] = useState("");
  const [experience, setExperience] = useState(saved.experience ?? "1-2");
  const [fresherOverride, setFresherOverride] = useState(null);

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionTier, setExtractionTier] = useState(null); // 1 | 2 | null — which tier produced the current resumeText
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [jdTouched, setJdTouched] = useState(false);

  const fresherMode = fresherOverride ?? experience === "fresher";
  const jdTooShort = jdTouched && jdText.trim().length > 0 && jdText.trim().length < MIN_JD;
  // !extracting guards against submitting stale text from a previous
  // upload while a new (up to ~60s) deep read for a re-uploaded file is
  // still in flight.
  const canSubmit = !extracting && resumeText.trim().length >= MIN_RESUME && jdText.trim().length >= MIN_RESUME;

  /**
   * Accept extracted text and always show it in the editable confirm
   * step — that step, not the tier-1/tier-2 trigger, is what actually
   * protects against a bad read reaching the pipeline.
   */
  function applyExtractedText(text, tier) {
    setResumeText(text);
    setExtractionTier(tier);
    setShowPaste(true);
  }

  /** Tier 2: upload the raw bytes for a Gemini multimodal read, only ever reached for PDFs. */
  async function escalateToDeepRead(file, pageCountHint) {
    setExtracting(true);
    try {
      const { text } = await extractDocument(file);
      const assessment = assessExtraction(text, { pageCount: pageCountHint });
      track(EVENTS.resume_extraction_assessed, {
        tier: 2, verdict: assessment.verdict, codes: assessment.codes, ...assessment.metrics,
      });

      if (assessment.verdict === "unusable") {
        setFileError("We still could not read this document reliably. Paste your resume text instead.");
        setShowPaste(true);
        return;
      }
      applyExtractedText(text, 2);
      track(EVENTS.resume_uploaded, { kind: "pdf-deep-read", chars: text.length });
    } catch (err) {
      setFileError(
        err instanceof ApiError && err.status === 429
          ? "You have reached your document-read limit for now. Paste your resume text instead."
          : "We could not read that PDF, even with a deeper scan. Paste your resume text instead.",
      );
      setShowPaste(true);
    } finally {
      setExtracting(false);
    }
  }

  async function ingest(file) {
    if (!file) return;
    setFileError("");
    setExtractionTier(null);

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
      let extracted;
      try {
        extracted = await extractPdfText(file);
      } catch (err) {
        if (err?.name === "PasswordException") {
          setFileError("This PDF is password protected. Remove the password, or paste your resume text instead.");
          setShowPaste(true);
          return;
        }
        if (err?.name === "InvalidPDFException") {
          setFileError("That doesn't look like a valid PDF. Paste your resume text instead.");
          setShowPaste(true);
          return;
        }
        // An unrecognized pdfjs failure is exactly the case a multimodal
        // read is most likely to recover from.
        await escalateToDeepRead(file, null);
        return;
      }

      const { text, pageCount } = extracted;
      const assessment = assessExtraction(text, { pageCount });
      track(EVENTS.resume_extraction_assessed, {
        tier: 1, verdict: assessment.verdict, codes: assessment.codes, ...assessment.metrics,
      });

      if (assessment.verdict === "good") {
        applyExtractedText(text, 1);
        track(EVENTS.resume_uploaded, { kind: "pdf", chars: text.length });
        return;
      }

      // Tier 1 escalates on anything short of "good" — the confirm step
      // below is what actually gates trust, so it's safe to lean toward
      // escalating whenever the local read is uncertain.
      await escalateToDeepRead(file, pageCount);
      return;
    }

    if (ext === ".doc" || ext === ".docx") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        const assessment = assessExtraction(text, { pageCount: 1 });
        track(EVENTS.resume_extraction_assessed, {
          tier: 1, verdict: assessment.verdict, codes: assessment.codes, ...assessment.metrics,
        });

        if (assessment.verdict === "unusable") {
          setFileError("We could not read that Word file cleanly. Paste your resume text instead.");
          setShowPaste(true);
          return;
        }
        applyExtractedText(text, 1);
        track(EVENTS.resume_uploaded, { kind: "docx", chars: text.length });
      } catch {
        setFileError("We could not read that Word file. Paste your resume text instead.");
        setShowPaste(true);
      }
      return;
    }

    const text = await file.text();
    applyExtractedText(text, 1);
    track(EVENTS.resume_uploaded, { kind: "text", chars: text.length });
  }

  function clearFile() {
    setFileName("");
    setResumeText("");
    setFileError("");
    setExtractionTier(null);
    setShowPaste(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    track(EVENTS.scan_started, { experience, fresherMode });
    track(EVENTS.jd_submitted, { chars: jdText.trim().length });

    try {
      const scan = await api.createScan({ resumeText, jdText, fresherMode });
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

            {extracting ? (
              <div className="analyze__drop analyze__drop--busy">
                <Loader2 size={ICON.lg} strokeWidth={ICON.stroke} className="analyze__spin" />
                <div className="ds-body-sm">Reading your document more closely…</div>
                <div className="ds-caption">This can take up to a minute.</div>
              </div>
            ) : fileName && !fileError ? (
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
                <div className="ds-caption">PDF, DOCX or TXT · up to 5 MB</div>
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

            {/* extractionTier === 2 means the browser's own read failed
                and this text came from a Gemini image read instead — the
                confirm step below is the actual safety net for that, so
                it needs to be impossible to miss. */}
            {extractionTier === 2 && !fileError ? (
              <Alert tone="warn" title="We read this as an image">
                We could not read this PDF cleanly, so we read it as an image instead. Please check the text below closely — this kind of reading can make mistakes.
              </Alert>
            ) : null}

            {/* Visible whenever no file has been read. It must NOT depend on
                resumeText being empty — that unmounts the field the moment
                the user types their first character into it. */}
            {(showPaste || !fileName) ? (
              <Field label={extractionTier ? "Review the extracted text" : "Or paste your resume"}>
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
            <ChoiceGroup
              label="3 · Experience"
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
            This changes the scoring, not just the wording — a fresher is not penalised for missing years.
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
              ? <>About 30 seconds · <Chip tone="muted">{fresherMode ? "Fresher" : experience}</Chip></>
              : "Add your resume and the job description to continue."}
          </div>
        </div>
      </form>
    </Page>
  );
}
