import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button, Field, Select, ICON } from "../../../../design-system";
import { download } from "../../../../api/client";
import { track, EVENTS } from "../../../../services/analytics";
import { TEMPLATE_OPTIONS } from "../../templateOptions";

/**
 * Export — spec §5. Pure rendering, zero LLM calls; re-render is just
 * picking a different template/format. Shared between FixesPanel
 * (post-improve) and EditPanel (post-save) — both hand it a
 * resumeVersionId, which GET /resume-version/:versionId/export renders
 * regardless of the version's `kind` ("rewritten" or "edited" alike).
 */
export function ExportControls({ resumeVersionId, scanId }) {
  const [template, setTemplate] = useState("ats-clean");
  const [format, setFormat] = useState("pdf");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await download(`/resume-version/${resumeVersionId}/export?template=${template}&format=${format}`, `resume.${format}`);
      track(EVENTS.resume_exported, { scanId, template, format });
    } catch (err) {
      setError(err.message ?? "Could not generate that file.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixes__export">
      <Field label="Template">
        {(a) => (
          <Select value={template} onChange={(e) => setTemplate(e.target.value)} {...a}>
            {TEMPLATE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Format">
        {(a) => (
          <Select value={format} onChange={(e) => setFormat(e.target.value)} {...a}>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </Select>
        )}
      </Field>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDownload}
        loading={downloading}
        iconLeft={<Download size={ICON.sm} strokeWidth={ICON.stroke} />}
      >
        Download
      </Button>
      {error ? <p className="ds-caption" style={{ color: "var(--critical)" }}>{error}</p> : null}
    </div>
  );
}
