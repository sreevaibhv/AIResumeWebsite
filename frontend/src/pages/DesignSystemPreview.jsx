import React, { useState } from "react";
import { Lock, FileText, Plus, Trash2, ArrowRight } from "lucide-react";
import {
  Button, IconButton,
  Field, Input, Textarea, Select, Checkbox, Radio, ChoiceGroup,
  Card, CardHeader, Divider,
  Chip, KeywordChip,
  Badge, SourceBadge, PriorityBadge, VerificationBadge, ConfidenceMark, LockedBlock,
  Tabs, TabPanel,
  Skeleton, SkeletonText, SkeletonCard, SkeletonRing,
  Alert, EmptyState, ErrorState,
  Modal, useToast, ICON,
} from "../design-system";

/**
 * Design-system preview. Not linked from the app; reachable at
 * /design-system for visual review and breakpoint checks.
 */

function Section({ title, note, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div>
        <h2 className="ds-h2">{title}</h2>
        {note ? <p className="ds-caption" style={{ marginTop: 4 }}>{note}</p> : null}
      </div>
      {children}
      <Divider />
    </section>
  );
}

const Row = ({ children }) => (
  <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap", alignItems: "center" }}>{children}</div>
);

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "score", label: "Score" },
  { key: "keywords", label: "Keywords", count: 7 },
  { key: "quality", label: "Quality" },
  { key: "fixes", label: "Fixes", count: 4 },
  { key: "prep", label: "Prep", disabled: true, disabledReason: "Unlocks after you optimize" },
];

export default function DesignSystemPreview() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [tier, setTier] = useState("MNC");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "var(--s-7) var(--page-pad) var(--s-9)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-6)",
        }}
      >
        <header>
          <div className="ds-label">PARSE// design system</div>
          <h1 className="ds-display" style={{ marginTop: 8 }}>Signal</h1>
          <p className="ds-body" style={{ color: "var(--ink-mid)", maxWidth: "60ch", marginTop: 8 }}>
            Phase 1 primitives. Every value below comes from a token — resize the window to
            check the breakpoints.
          </p>
        </header>

        <Section title="Typography" note="Sans for prose, mono for every number and label.">
          <Card>
            <div className="ds-display">Display 40</div>
            <div className="ds-h1">Heading 1 — 28</div>
            <div className="ds-h2">Heading 2 — 21</div>
            <div className="ds-h3">Heading 3 — 16</div>
            <p className="ds-body" style={{ marginTop: 8 }}>Body 15 — the resume reads as junior against a mid-level posting.</p>
            <p className="ds-body-sm" style={{ color: "var(--ink-mid)" }}>Body small 13.5 — secondary explanation.</p>
            <p className="ds-caption">Caption 12.5 — muted supporting text.</p>
            <div className="ds-label" style={{ marginTop: 8 }}>Label — mono, tracked</div>
            <div className="ds-data">Data 12 — 1234567890</div>
            <Row>
              <span className="ds-score-sm ds-good">88</span>
              <span className="ds-score-md ds-warn">68</span>
              <span className="ds-score-xl ds-critical">43</span>
            </Row>
          </Card>
        </Section>

        <Section title="Colour" note="Semantic colour carries meaning and is always paired with a word or an icon.">
          <Row>
            {[
              ["accent", "--accent"], ["good", "--good"], ["warn", "--warn"], ["critical", "--critical"],
              ["ink", "--ink"], ["ink-mid", "--ink-mid"], ["ink-mute", "--ink-mute"], ["rule", "--rule"],
            ].map(([name, v]) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ width: 84, height: 40, background: `var(${v})`, borderRadius: "var(--r-sm)", border: "1px solid var(--rule)" }} />
                <span className="ds-data" style={{ color: "var(--ink-mute)" }}>{name}</span>
              </div>
            ))}
          </Row>
        </Section>

        <Section title="Button">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button
              loading={loading}
              onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1600); }}
            >
              Click to load
            </Button>
          </Row>
          <Row>
            <Button iconLeft={<Plus size={ICON.sm} strokeWidth={ICON.stroke} />}>Analyse new job</Button>
            <Button variant="secondary" iconRight={<ArrowRight size={ICON.sm} strokeWidth={ICON.stroke} />}>Continue</Button>
            <IconButton icon={<Trash2 size={ICON.md} strokeWidth={ICON.stroke} />} label="Delete scan" />
          </Row>
        </Section>

        <Section title="Form controls" note="Field owns the label, hint, error and the aria wiring between them.">
          <Card>
            <Field label="Email" required>
              {(a) => <Input type="email" placeholder="you@example.com" {...a} />}
            </Field>
            <Field label="Password" hint="8+ characters">
              {(a) => <Input type="password" placeholder="••••••••" {...a} />}
            </Field>
            <Field label="Job description" error="That looks like a job title, not a description.">
              {(a) => <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full posting…" {...a} />}
            </Field>
            <Field label="Experience">
              {(a) => (
                <Select defaultValue="1-2" {...a}>
                  <option value="fresher">Fresher</option>
                  <option value="1-2">1–2 years</option>
                  <option value="3-5">3–5 years</option>
                  <option value="5+">5+ years</option>
                </Select>
              )}
            </Field>
            <ChoiceGroup
              label="Target tier"
              name="tier"
              value={tier}
              onChange={setTier}
              options={["Startup", "MNC", "PSU", "Government"]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
              <Checkbox label="Fresher mode" description="Score projects and certifications instead of penalising missing experience" defaultChecked />
              <Radio name="demo" label="Startup" defaultChecked />
              <Radio name="demo" label="MNC" />
            </div>
          </Card>
        </Section>

        <Section title="Card">
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Card><CardHeader title="Default" subtitle="Neutral container" /><p className="ds-body-sm">Borders and tone, not shadows.</p></Card>
            <Card tone="accent"><CardHeader title="Next step" /><p className="ds-body-sm">The dashboard band.</p></Card>
            <Card tone="good"><CardHeader title="Verified" /><p className="ds-body-sm">Every claim traced.</p></Card>
            <Card tone="warn"><CardHeader title="Verify this" /><p className="ds-body-sm">A factual claim was introduced.</p></Card>
            <Card tone="critical"><CardHeader title="Not published" /><p className="ds-body-sm">Rewrite failed verification.</p></Card>
            <Card interactive onClick={() => toast.info("Card clicked")}><CardHeader title="Interactive" subtitle="Renders as a button" /></Card>
          </div>
        </Section>

        <Section title="Chips and keywords">
          <Row>
            <Chip>Neutral</Chip>
            <Chip tone="accent">Accent</Chip>
            <Chip tone="good">Strong match</Chip>
            <Chip tone="warn">Partial</Chip>
            <Chip tone="critical">Missing</Chip>
            <Chip tone="muted">Muted</Chip>
            <Chip tone="neutral" icon={<FileText size={ICON.xs} strokeWidth={ICON.stroke} />}>With icon</Chip>
          </Row>
          <Row>
            <KeywordChip term="PostgreSQL" state="exact" />
            <KeywordChip term="Redis" state="semantic" confidence={0.81} />
            <KeywordChip term="Kafka" state="partial" confidence={0.62} />
            <KeywordChip term="Docker" state="missing" />
          </Row>
        </Section>

        <Section title="Trust badges" note="How the product shows its working.">
          <Row>
            <SourceBadge source="code" />
            <SourceBadge source="llm" />
            <PriorityBadge priority="critical" />
            <PriorityBadge priority="important" />
            <PriorityBadge priority="nice" />
          </Row>
          <Row>
            <VerificationBadge state="verified" />
            <VerificationBadge state="unconfirmed" />
            <VerificationBadge state="failed" />
          </Row>
          <Row>
            <ConfidenceMark conf="high" />
            <ConfidenceMark conf="medium" />
            <ConfidenceMark conf="low" />
            <Badge tone="accent">Generic badge</Badge>
          </Row>
          <LockedBlock count={11} valueHint="+14 points" onUnlock={() => toast.info("Upgrade flow — Phase 9")}>
            <p className="ds-body-sm">Add Redis to your skills section and name it in the caching project.</p>
          </LockedBlock>
        </Section>

        <Section title="Tabs" note="Arrow keys move between tabs; the strip scrolls on a phone.">
          <Card pad="none" style={{ padding: "0 var(--s-4) var(--s-4)" }}>
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
            <TabPanel tabKey="overview" value={tab}><p className="ds-body-sm">Verdict, rings, strengths, problems, fix first.</p></TabPanel>
            <TabPanel tabKey="score" value={tab}><p className="ds-body-sm">Five categories with earned, lost and provenance.</p></TabPanel>
            <TabPanel tabKey="keywords" value={tab}><p className="ds-body-sm">Exact versus semantic, and the requirement ledger.</p></TabPanel>
            <TabPanel tabKey="quality" value={tab}><p className="ds-body-sm">Section scores and weak bullets.</p></TabPanel>
            <TabPanel tabKey="fixes" value={tab}><p className="ds-body-sm">The ranked roadmap.</p></TabPanel>
          </Card>
        </Section>

        <Section title="Loading" note="Skeletons preserve the final layout so nothing jumps.">
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <SkeletonCard />
            <Card><Row><SkeletonRing /><SkeletonRing /></Row></Card>
            <Card><SkeletonText lines={4} /><div style={{ height: 12 }} /><Skeleton height={38} radius="sm" /></Card>
          </div>
        </Section>

        <Section title="Alerts">
          <Alert tone="info" title="Cached result">This resume and job description were analysed before, so no credit was used.</Alert>
          <Alert tone="good" title="Verified">Every claim in the rewrite traces back to your original resume.</Alert>
          <Alert tone="warn" title="Verify this claim">
            “12 endpoints” does not appear in your original resume. Confirm it is accurate, or edit it.
          </Alert>
          <Alert
            tone="critical"
            title="We did not publish this rewrite"
            actions={<><Button size="sm" variant="secondary">Try again</Button><Button size="sm" variant="ghost">Fix manually</Button></>}
            onDismiss={() => {}}
          >
            The rewrite made claims we could not trace to your resume, so we kept your original.
          </Alert>
        </Section>

        <Section title="Empty and error states">
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <EmptyState
              icon={<FileText size={ICON.xl} strokeWidth={ICON.stroke} />}
              title="Analyse your first job"
              description="Paste a job description and your resume, and we will show you exactly which requirements you miss."
              action={<Button>Analyse a job</Button>}
            />
            <ErrorState
              title="We could not finish the analysis"
              description="Something went wrong while comparing your resume with the job description."
              reassurance="Your resume is safe and your credit has not been used."
              action={<Button>Try again</Button>}
              secondaryAction={<Button variant="ghost">Back to dashboard</Button>}
            />
          </div>
        </Section>

        <Section title="Toast and modal">
          <Row>
            <Button variant="secondary" onClick={() => toast.success("Change accepted")}>Success toast</Button>
            <Button variant="secondary" onClick={() => toast.error("Could not save", { description: "Check your connection and try again." })}>Error toast</Button>
            <Button variant="secondary" onClick={() => toast.warn("2 claims still need confirming")}>Warning toast</Button>
            <Button onClick={() => setModalOpen(true)} iconLeft={<Lock size={ICON.sm} strokeWidth={ICON.stroke} />}>Open modal</Button>
          </Row>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Delete this analysis?"
            description="This removes the report and every version created from it."
            footer={<>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { setModalOpen(false); toast.success("Analysis deleted"); }}>Delete</Button>
            </>}
          >
            <p>Your original resume file is not affected. This cannot be undone.</p>
          </Modal>
        </Section>
      </main>
    </div>
  );
}
