import React, { useState } from "react";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import {
  Card, Button, Alert, Field, Input, Textarea, Chip, IconButton, ICON,
} from "../../../design-system";
import { api, ApiError } from "../../../api/client";
import { track, EVENTS } from "../../../services/analytics";
import { SavePrompt } from "./shared/SavePrompt";
import { ExportControls } from "./shared/ExportControls";
import { CategoryDeltaList } from "./shared/CategoryDeltaList";
import { VerdictBanner } from "./shared/VerdictBanner";

/**
 * Edit — a structured-resume editor with advisory re-verification on save.
 *
 * Two different "which resume" questions, both correct, not to be
 * conflated: the form starts from the LATEST resumeVersion (any kind) —
 * what the user was last looking at — while the server's VerifyAgent check
 * on save always compares against `data.resume`, the scan's true original.
 * That choice is made server-side (scan.service.ts saveEditedVersion); the
 * form here just needs the right starting values.
 *
 * Save is deliberately never autosave: each save costs roughly six LLM
 * calls (VerifyAgent + the full Wave 2 rescore + Roadmap), so it is a
 * single, explicit, disable-while-in-flight action.
 */

function latestVersionContent(data) {
  const versions = data.resumeVersions ?? [];
  if (!versions.length) return data.resume;
  const latest = [...versions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-1)[0];
  return latest?.content ?? data.resume;
}

function TagEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  }

  function remove(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <Field label={label}>
      {() => (
        <div className="edit__tags">
          <div className="edit__taglist">
            {items.map((item, i) => (
              <Chip key={`${item}-${i}`} onRemove={() => remove(i)}>{item}</Chip>
            ))}
          </div>
          <div className="edit__tagadd">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder={placeholder}
            />
            <Button variant="secondary" size="sm" onClick={add} iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>
              Add
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}

function ExperienceEditor({ items, onChange }) {
  function updateItem(i, patch) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { title: "", company: "", start: "", end: "", bullets: [] }]);
  }

  return (
    <div className="edit__section">
      <div className="ds-label">Experience</div>
      {items.map((item, i) => (
        <Card key={i} pad="md" className="edit__item">
          <div className="edit__itemhead">
            <div className="edit__itemgrid">
              <Field label="Title">{(a) => <Input value={item.title} onChange={(e) => updateItem(i, { title: e.target.value })} {...a} />}</Field>
              <Field label="Company">{(a) => <Input value={item.company} onChange={(e) => updateItem(i, { company: e.target.value })} {...a} />}</Field>
              <Field label="Start">{(a) => <Input value={item.start} onChange={(e) => updateItem(i, { start: e.target.value })} {...a} />}</Field>
              <Field label="End">{(a) => <Input value={item.end} onChange={(e) => updateItem(i, { end: e.target.value })} {...a} />}</Field>
            </div>
            <IconButton icon={<Trash2 size={ICON.sm} strokeWidth={ICON.stroke} />} label="Remove this role" onClick={() => remove(i)} />
          </div>
          <Field label="Bullets" hint="One per line">
            {(a) => (
              <Textarea
                value={item.bullets.join("\n")}
                onChange={(e) => updateItem(i, { bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })}
                rows={4}
                {...a}
              />
            )}
          </Field>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onClick={add} iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>Add role</Button>
    </div>
  );
}

function ProjectEditor({ items, onChange }) {
  function updateItem(i, patch) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { name: "", bullets: [] }]);
  }

  return (
    <div className="edit__section">
      <div className="ds-label">Projects</div>
      {items.map((item, i) => (
        <Card key={i} pad="md" className="edit__item">
          <div className="edit__itemhead">
            <Field label="Name">{(a) => <Input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} {...a} />}</Field>
            <IconButton icon={<Trash2 size={ICON.sm} strokeWidth={ICON.stroke} />} label="Remove this project" onClick={() => remove(i)} />
          </div>
          <Field label="Bullets" hint="One per line">
            {(a) => (
              <Textarea
                value={item.bullets.join("\n")}
                onChange={(e) => updateItem(i, { bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })}
                rows={3}
                {...a}
              />
            )}
          </Field>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onClick={add} iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>Add project</Button>
    </div>
  );
}

function EducationEditor({ items, onChange }) {
  function updateItem(i, patch) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { degree: "", institution: "", year: "" }]);
  }

  return (
    <div className="edit__section">
      <div className="ds-label">Education</div>
      {items.map((item, i) => (
        <Card key={i} pad="md" className="edit__item">
          <div className="edit__itemhead">
            <div className="edit__itemgrid">
              <Field label="Degree">{(a) => <Input value={item.degree} onChange={(e) => updateItem(i, { degree: e.target.value })} {...a} />}</Field>
              <Field label="Institution">{(a) => <Input value={item.institution} onChange={(e) => updateItem(i, { institution: e.target.value })} {...a} />}</Field>
              <Field label="Year">{(a) => <Input value={item.year} onChange={(e) => updateItem(i, { year: e.target.value })} {...a} />}</Field>
            </div>
            <IconButton icon={<Trash2 size={ICON.sm} strokeWidth={ICON.stroke} />} label="Remove this entry" onClick={() => remove(i)} />
          </div>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onClick={add} iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>Add education</Button>
    </div>
  );
}

export function EditPanel({ data, onSaved }) {
  const [fields, setFields] = useState(() => latestVersionContent(data));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function patchContact(patch) {
    setFields((f) => ({ ...f, contact: { ...f.contact, ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await api.saveEditedResume(data.id, fields);
      const version = {
        id: res.resumeVersionId,
        kind: "edited",
        verified: res.advisory.passed,
        createdAt: new Date().toISOString(),
        content: res.structuredResume,
        beforeScore: res.beforeScore,
        afterScore: res.afterScore,
      };
      setResult(res);
      onSaved(version);
      track(EVENTS.resume_edit_saved, { scanId: data.id, after: res.afterScore, advisoryPassed: res.advisory.passed });
      if (!res.advisory.passed) {
        track(EVENTS.resume_edit_advisory_flagged, { scanId: data.id, claims: res.advisory.flaggedClaims.length });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err.message ?? "Could not save this edit."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="report__stack">
      <Card pad="lg">
        <div className="ds-label">Contact</div>
        <div className="edit__itemgrid">
          <Field label="Name">{(a) => <Input value={fields.contact.name} onChange={(e) => patchContact({ name: e.target.value })} {...a} />}</Field>
          <Field label="Email">{(a) => <Input value={fields.contact.email} onChange={(e) => patchContact({ email: e.target.value })} {...a} />}</Field>
          <Field label="Phone">{(a) => <Input value={fields.contact.phone} onChange={(e) => patchContact({ phone: e.target.value })} {...a} />}</Field>
          <Field label="LinkedIn" hint="optional">{(a) => <Input value={fields.contact.linkedin ?? ""} onChange={(e) => patchContact({ linkedin: e.target.value })} {...a} />}</Field>
          <Field label="GitHub" hint="optional">{(a) => <Input value={fields.contact.github ?? ""} onChange={(e) => patchContact({ github: e.target.value })} {...a} />}</Field>
        </div>
      </Card>

      <Card pad="lg">
        <Field label="Headline">{(a) => <Input value={fields.headline} onChange={(e) => setFields((f) => ({ ...f, headline: e.target.value }))} {...a} />}</Field>
        <Field label="Summary">{(a) => <Textarea value={fields.summary} onChange={(e) => setFields((f) => ({ ...f, summary: e.target.value }))} rows={4} {...a} />}</Field>
      </Card>

      <Card pad="lg">
        <TagEditor label="Skills" items={fields.skills} onChange={(skills) => setFields((f) => ({ ...f, skills }))} placeholder="Add a skill, press Enter" />
      </Card>

      <Card pad="lg">
        <ExperienceEditor items={fields.experience} onChange={(experience) => setFields((f) => ({ ...f, experience }))} />
      </Card>

      <Card pad="lg">
        <ProjectEditor items={fields.projects} onChange={(projects) => setFields((f) => ({ ...f, projects }))} />
      </Card>

      <Card pad="lg">
        <EducationEditor items={fields.education} onChange={(education) => setFields((f) => ({ ...f, education }))} />
      </Card>

      <Card pad="lg">
        <TagEditor label="Certifications" items={fields.certifications} onChange={(certifications) => setFields((f) => ({ ...f, certifications }))} placeholder="Add a certification, press Enter" />
      </Card>

      {error ? <Alert tone="critical" title="Could not save this edit">{error}</Alert> : null}

      <Card pad="lg">
        <div className="ds-label">Save & re-verify</div>
        <p className="ds-body-sm edit__save-copy">
          We check your edit against your original resume and re-score it against this job description.
          Nothing you write is ever blocked from saving — if a claim can't be traced back, we tell you, not stop you.
        </p>

        {!result ? (
          <Button onClick={handleSave} loading={saving}>Save & re-verify</Button>
        ) : (
          <Alert tone="good" title="Saved">
            <p>Re-scored: {result.beforeScore} → {result.afterScore}.</p>
            <CategoryDeltaList categoryDelta={result.categoryDelta} />
          </Alert>
        )}

        {result && !result.advisory.passed ? (
          <Alert tone="warn" title="A few claims don't clearly trace back to your original resume">
            <p className="ds-caption">Saved anyway — this is worth double-checking before you send it out:</p>
            <ul className="fixes__claims">
              {result.advisory.flaggedClaims.map((c, i) => (
                <li key={i}>
                  <ShieldAlert size={ICON.sm} strokeWidth={2} aria-hidden="true" />
                  <span><strong>"{c.claim}"</strong> — {c.reason}</span>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {result ? <VerdictBanner verdict={result.verdict} /> : null}

        {result ? (
          <div className="fixes__postimprove">
            <SavePrompt data={data} resumeVersionId={result.resumeVersionId} structuredResume={result.structuredResume} afterScore={result.afterScore} />
            <ExportControls resumeVersionId={result.resumeVersionId} scanId={data.id} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
