import React, { useState } from "react";
import { Button, Alert, Field, Input } from "../../../../design-system";
import { api } from "../../../../api/client";
import { track, EVENTS } from "../../../../services/analytics";

/**
 * Save — spec §6. The prompt appears only after a successful improve or a
 * saved edit: the library holds resumes worth keeping, and an un-touched
 * original is already sitting on the user's disk. Shared between
 * FixesPanel (post-improve) and EditPanel (post-save).
 */
export function SavePrompt({ data, resumeVersionId, structuredResume, afterScore }) {
  const [label, setLabel] = useState(`${data.role} — ${data.company ?? ""}`.replace(/ — $/, ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.saveResume({
        structuredResume,
        label: label.trim() || undefined,
        role: data.role,
        company: data.company,
        score: afterScore,
        sourceScanId: data.id,
      });
      setSaved(true);
      track(EVENTS.resume_saved, { scanId: data.id, resumeVersionId });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <Alert tone="good" title="Saved to My Resumes">Find it any time under My Resumes in the sidebar.</Alert>;
  }

  return (
    <div className="fixes__save">
      <Field label="Save this version as">
        {(a) => <Input value={label} onChange={(e) => setLabel(e.target.value)} {...a} />}
      </Field>
      <Button variant="secondary" size="sm" onClick={submit} loading={saving}>Save to My Resumes</Button>
    </div>
  );
}

