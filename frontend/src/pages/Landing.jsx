import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ScanLine, Target, ShieldCheck, MessagesSquare, TrendingUp, Lock, ArrowRight,
} from "lucide-react";
import { Button, Card, Chip, SourceBadge, KeywordChip, ICON } from "../design-system";
import "./Landing.css";

/**
 * Landing — one job: get a resume and a job description into the box.
 *
 * Copy rule for this whole surface: no promise of an interview, a score
 * gain, or a percentage improvement. The honest claim is diagnostic,
 * and it is also the stronger one — nobody else tells you *why*.
 */

const STEPS = [
  { n: "01", title: "Analyse", body: "Your resume against one specific job description — not against a generic template." },
  { n: "02", title: "Understand", body: "Every point earned and lost, with the evidence behind it." },
  { n: "03", title: "Fix", body: "A ranked list of changes, highest value first." },
  { n: "04", title: "Verify", body: "Review every AI edit before it touches your resume." },
  { n: "05", title: "Prepare", body: "Interview questions built from your actual gaps." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ---------------- hero ---------------- */}
      <section className="landing__hero">
        <div className="landing__hero-copy">
          <h1 className="ds-display">
            Get more interviews.<br />Not just a better resume.
          </h1>
          <p className="landing__lede">
            Analyse your resume against the job you actually want, find what is costing you the
            interview, fix it, and walk in prepared.
          </p>
          <div className="landing__cta">
            <Button size="lg" onClick={() => navigate("/login")} iconRight={<ArrowRight size={ICON.sm} strokeWidth={ICON.stroke} />}>
              Analyse my resume
            </Button>
            <a href="#how" className="landing__secondary">See how it works</a>
          </div>
          <p className="ds-caption">Free to start · your first analysis takes about 30 seconds</p>
        </div>

        {/* A real fragment of a real report, not a stock illustration. */}
        <Card className="landing__preview" pad="lg">
          <div className="landing__preview-head">
            <div>
              <div className="ds-label">Backend Developer · Razorpay</div>
              <div className="ds-h3" style={{ marginTop: 4 }}>Match 43 / 100</div>
            </div>
            <Chip tone="critical">Weak match</Chip>
          </div>

          <div className="landing__rows">
            <div className="landing__row">
              <span>Keyword coverage</span>
              <span className="ds-data"><SourceBadge source="code" /> 9 / 30</span>
            </div>
            <div className="landing__row">
              <span>Experience fit</span>
              <span className="ds-data"><SourceBadge source="llm" /> 0 / 20</span>
            </div>
            <div className="landing__row">
              <span>Bullet quality</span>
              <span className="ds-data"><SourceBadge source="llm" /> 5 / 20</span>
            </div>
          </div>

          <div className="landing__keywords">
            <KeywordChip term="PostgreSQL" state="exact" />
            <KeywordChip term="Redis" state="semantic" confidence={0.81} />
            <KeywordChip term="Docker" state="missing" />
          </div>

          <p className="ds-caption landing__preview-note">
            Every number says where it came from — measured locally, or judged by a model.
          </p>
        </Card>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="landing__section" id="how">
        <div className="ds-label">How it works</div>
        <h2 className="ds-h1">From resume to interview, in one loop</h2>
        <div className="landing__steps">
          {STEPS.map((s) => (
            <div key={s.n} className="landing__step">
              <span className="landing__step-n">{s.n}</span>
              <div className="ds-h3">{s.title}</div>
              <p className="ds-body-sm">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- the differentiator ---------------- */}
      <section className="landing__section landing__section--feature">
        <div className="landing__feature">
          <div>
            <Chip tone="accent">Built for India</Chip>
            <h2 className="ds-h1" style={{ marginTop: 12 }}>
              Naukri does not read your resume the way a company ATS does
            </h2>
            <p className="ds-body">
              Job portals rank on their own parsers. A resume can score well generically and badly
              on the portal that actually gates the job — so we score both, and tell you which gap
              is costing you.
            </p>
            <p className="ds-body-sm landing__muted">
              We also calibrate for who you are applying to. A PSU screens for things a startup
              never looks at, and freshers get scored on projects instead of being penalised for
              missing years.
            </p>
          </div>

          <Card pad="lg" className="landing__gapcard">
            <div className="landing__gaprow">
              <div>
                <div className="ds-label">Generic ATS</div>
                <div className="ds-score-md ds-critical">43</div>
              </div>
              <div>
                <div className="ds-label">Naukri</div>
                <div className="ds-score-md ds-warn">48</div>
              </div>
            </div>
            <p className="ds-body-sm landing__gapreason">
              “Your resume headline is blank, and Naukri looks for the exact job title right at the
              top.”
            </p>
          </Card>
        </div>
      </section>

      {/* ---------------- capability grid ---------------- */}
      <section className="landing__section">
        <div className="ds-label">What you get</div>
        <div className="landing__features">
          {[
            { Icon: ScanLine, title: "ATS intelligence", body: "Exact and semantic matching, side by side, so you can see what a parser sees and what a human would." },
            { Icon: Target, title: "A ranked fix list", body: "Not fourteen suggestions of equal weight — an order, with what each change is worth." },
            { Icon: ShieldCheck, title: "Verified rewriting", body: "Every claim is traced back to your original. If we cannot trace it, we do not publish it." },
            { Icon: MessagesSquare, title: "Interview prep", body: "Questions generated from your gaps and this job, each explaining why it will be asked." },
            { Icon: TrendingUp, title: "Before and after", body: "Re-scored after your edits, so the improvement is measured rather than claimed." },
            { Icon: Lock, title: "Your resume stays yours", body: "Analysed against the job you name, and nothing else. Delete it whenever you want." },
          ].map(({ Icon, title, body }) => (
            <Card key={title} className="landing__feature-card">
              <Icon size={ICON.lg} strokeWidth={ICON.stroke} className="landing__feature-icon" />
              <div className="ds-h3">{title}</div>
              <p className="ds-body-sm">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- trust ---------------- */}
      <section className="landing__section landing__section--trust">
        <Card tone="good" pad="lg">
          <div className="ds-label" style={{ color: "var(--good)" }}>Why you can trust the rewrite</div>
          <h2 className="ds-h2" style={{ marginTop: 8 }}>
            We would rather ship nothing than ship something you cannot defend
          </h2>
          <p className="ds-body" style={{ marginTop: 8 }}>
            If our rewrite makes a claim we cannot trace to your original resume — a metric, a team
            size, a title — we keep your original and tell you exactly what we rejected. You will
            never find a sentence in your resume that you have to explain away in an interview.
          </p>
        </Card>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="landing__section landing__final">
        <h2 className="ds-h1">See what one job description says about your resume</h2>
        <p className="ds-body">It takes about 30 seconds, and the diagnosis is free.</p>
        <div className="landing__cta landing__cta--center">
          <Button size="lg" onClick={() => navigate("/login")}>Analyse my resume</Button>
          <Link to="/login" className="landing__secondary">I already have an account</Link>
        </div>
      </section>
    </div>
  );
}
