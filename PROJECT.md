# PARSE// — Project Overview

AI Resume Intelligence for the Indian job market.

This is the single orientation document for the project: why it exists, what it
does, how it is built, what actually works today, and what is still missing.
Everything here is checked against the code in this repository rather than
against the plan it was built from.

- Design deliverable: [`frontend/UX-CONTRACT.md`](frontend/UX-CONTRACT.md)
- Build-status detail and correction log: [`README.md`](README.md)

> **Note on the plan of record.** `README.md` and many source comments cite
> `PARSE_Master_Plan.md` (§-numbers throughout). That file is **not in this
> repository.** The section references are therefore unresolvable from the code
> alone. Either commit the plan or treat this document as the plan of record.

---

## 1. Motive

Job seekers do not want a better-looking resume. They want an interview.

Most resume tools sell polish — templates, fonts, phrasing. That solves a
problem candidates do not have. The actual failure is invisible: a resume is
filtered out before a human reads it, and the candidate never learns why.

PARSE// exists to make that filter visible and then fix it:

> **Why didn't I get the interview, and what specifically do I change?**

Three commitments follow from that, and they shape every technical decision in
the codebase:

1. **Diagnose against a specific job.** A resume is not good or bad in the
   abstract; it is a match or a mismatch for one posting. Every analysis takes
   a resume *and* a job description.
2. **Show the working.** A score nobody can interrogate is a horoscope. Every
   number carries its evidence and its provenance — computed locally, or
   judged by a model.
3. **Never invent experience.** The rewrite may sharpen how a candidate says
   what they did. It may not invent what they did. This is enforced in code,
   not by prompt politeness.

### Why India specifically

The Indian early-career market has properties a generic ATS tool ignores:

- **Portal-first hiring.** Naukri and similar portals rank resumes with their
  own parsers, which behave differently from a US-style ATS. A resume can score
  well generically and badly on the portal that actually gates the job.
- **Employer tiers behave differently.** Startup, MNC, PSU and Government
  screen for genuinely different things. One scoring rubric across all four is
  wrong for at least three of them.
- **Freshers are the volume segment**, and are penalised by scoring that treats
  "years of experience" as the primary signal when projects are the real
  evidence.

These are first-class inputs to the product, not settings buried in a menu.

---

## 2. Requirements

### Functional

| # | Requirement | Status |
|---|---|---|
| Resume ingestion | Accept PDF/DOCX/TXT, extract text | Built — PDF parsed client-side via pdf.js |
| JD ingestion | Accept pasted job description text | Built |
| Structured parsing | Resume and JD into typed objects | Built — `ParseResumeAgent`, `ParseJDAgent` |
| Deterministic checks | Keywords, formatting, metrics, contact — no model | Built — `DeterministicCheckAgent`, zero cost |
| Semantic matching | Match meaning, not just literal keywords | Built — `SemanticMatchAgent` + pgvector |
| Quality assessment | Section scores, weak bullet detection | Built — `QualityAgent` |
| Tier calibration | Adjust guidance for Startup/MNC/PSU/Government | Built — `TierCalibrationAgent` |
| Portal score | Naukri-specific score + gap explanation | Built — `NaukriScoreAgent` |
| Scoring | One 0–100 score with per-category breakdown | Built — `ScoreAggregator`, no model call |
| Fix roadmap | Ranked fixes with estimated gain and confidence | Built — `RoadmapAgent` |
| AI rewrite | Improve the resume against the roadmap | Built — `RewriteAgent` |
| Hallucination guard | Every claim traceable to the original | Built — `VerifyAgent`, fails closed |
| Re-score | Score the rewritten resume | Built — inside `RewritePipeline` |
| Interview prep | Questions derived from resume + JD + gaps | Built — `InterviewPrepAgent` |
| Caching | Identical inputs must not re-bill | Built — Redis, options in the key |
| Cost telemetry | Per-call model, tokens, cost, latency | Built — `UsageLog` |
| Auth | Email/password + Google SSO | Partial — email works, Google inert |
| Credit gating | Free tier limits, paid unlock | **Not built** — tables exist, unused |
| Payments | Razorpay + GST handling | **Not built** |
| WhatsApp | Scan via WhatsApp, deep-link to report | **Not built** |

### Non-functional

- **Reliability:** a rewrite must never ship an unverifiable claim. Hard
  requirement, not best-effort.
- **Cost:** every model call is logged with token counts so unit economics are
  measurable rather than assumed.
- **Latency:** a scan should complete in well under a minute. *Measured live:
  ~30 seconds.*
- **Availability:** cache and rate limiting degrade gracefully — Redis being
  down must not break a scan.
- **Provider independence:** no agent may be coupled to one LLM vendor.

---

## 3. Scope

### In scope (v1)

- Resume + JD analysis producing a score, evidence and a ranked fix list
- Verified AI rewriting with explicit change review
- Automatic re-score after rewrite
- Interview preparation derived from the candidate's actual gaps
- India-specific tiering and fresher handling
- Accounts, scan history, credit-gated paid features

### Explicitly out of scope

- **A resume builder or template gallery.** The product analyses a resume the
  candidate already has.
- **A job board.** PARSE// does not source or list jobs.
- **Voice or video mock interviews.** Prep is written questions and reasoning.
- **Auto-apply.** The product ends at "you are ready to apply".
- **Generic AI chat.** No open-ended assistant surface.
- **LinkedIn/profile optimisation.** Resume and JD only.

---

## 4. Architecture

```
                    Browser (React + Vite)
                             │  /api/*  (Vite dev proxy)
                             ▼
                    NestJS API  ── ScanController, AuthController
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
          ScanPipeline            RewritePipeline
        (3 waves, 7 calls)     (rewrite → verify → re-score)
                 │                       │
                 └───────────┬───────────┘
                             ▼
                 completeStructured()  ── schema-validated LLM calls
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          Anthropic       OpenAI         Gemini      ← only Gemini keyed today
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  Postgres + pgvector      Redis              UsageLog
  scans, versions,     cache + rate       per-call cost
  users, ledger          limiting          and latency
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, pdf.js |
| Backend | NestJS, TypeScript 5.9 |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Database | PostgreSQL + pgvector extension |
| Cache / limits | Redis via ioredis |
| Models | Gemini (Anthropic + OpenAI implemented, unrouted) |
| Auth | JWT access + rotating refresh tokens, Passport Google strategy |

### The agent layer

Sixteen files in `backend/src/agents/`. Two do real work with **no model call
at all**, which matters for both cost and trust:

| Agent | Model tier | Role |
|---|---|---|
| `ParseResumeAgent` | cheap | Raw text → `ParsedResume` |
| `ParseJDAgent` | cheap | Raw text → `ParsedJD` |
| `DeterministicCheckAgent` | **none — pure code** | Keywords, metrics, verbs, contact validity |
| `SemanticMatchAgent` | mid | Meaning-level matching, seniority and domain fit |
| `QualityAgent` | mid | Section scores, weak bullets |
| `NaukriScoreAgent` | cheap | Portal score + gap reason |
| `TierCalibrationAgent` | cheap | Startup/MNC/PSU/Government adjustment |
| `ScoreAggregator` | **none — pure arithmetic** | Weighted 0–100 + category breakdown |
| `RoadmapAgent` | frontier | Ranked fixes, estimated gain, confidence |
| `RewriteAgent` | frontier | Improved resume + change summary |
| `VerifyAgent` | frontier | Traceability check on every claim |
| `RecruiterCommentAgent` | mid | Six-second recruiter read |
| `InterviewPrepAgent` | cheap | Technical + HR questions with reasoning |
| `ReferralMessageAgent` | cheap | Built, **not wired to any endpoint** |

### Data model

`backend/prisma/schema.prisma` — ten models:

- **Identity:** `User`, `RefreshToken`
- **Core:** `Scan` (inputs, options, and all pipeline output as JSON),
  `ResumeVersion` (original / rewritten, with `verified` and `flagged`),
  `InterviewPrepSet`
- **Vector:** `SkillEmbedding` — normalised term → `vector(1536)`, cached
  because skill terms repeat heavily across users
- **Money:** `CreditLedger` (append-only, never a mutable balance),
  `PricingVariant`, `Transaction`
- **Telemetry:** `UsageLog`

---

## 5. Backend working principles

**1. Waves, not a chain.** `ScanPipeline` runs three waves. Wave 1 parses
resume and JD in parallel. Wave 2 runs deterministic checks (free) alongside
four model calls concurrently, then aggregates the score in pure code. Wave 3
builds the roadmap, which needs the score as input. Seven model calls total.

**2. Arithmetic where arithmetic will do.** The headline score is computed by
`ScoreAggregator` with fixed weights and no model involvement:

```
Keyword coverage  30      Structure        15
Experience fit    20      Contact & format 15
Bullet quality    20      ─────────────────────
                          Total           100
```

The model contributes *inputs* (experience fit, bullet quality). It does not
choose the final number. That makes the score reproducible and explains why
each category can be labelled `source: "code"` or `source: "llm"`.

**3. Structured output is validated, then repaired once.**
`completeStructured()` parses the model's JSON against a Zod schema. On
failure it retries exactly once, telling the model what was wrong. A second
failure throws rather than passing a malformed object downstream.

**4. The rewrite fails closed.** `RewritePipeline` verifies, and on failure
re-prompts with the flagged claims — up to two retries. If verification still
fails it returns **the original resume** plus the flagged claims. It never
ships an unverified rewrite. This is the single most important behaviour in
the backend:

```ts
if (attempt === maxRetries) {
  return { status: "verification_failed", resume: original, flaggedClaims: ... };
}
```

**5. Caching includes the options.** The cache key is
`sha256(resume + jd + tier + fresherMode)`. The same resume scored as PSU is
not the same scan as scored for a Startup, and must not return a cached result.

**6. Infrastructure fails soft.** Redis errors are swallowed — a cache miss or
a skipped rate-limit check never breaks a scan. Rate limiting deliberately
fails *open*, choosing availability over strict enforcement.

**7. Providers are behind one interface.** Each agent declares a
provider+model pair in `MODEL_ROUTING`. Restoring the multi-provider split is
a table edit. Per-agent override via `MODEL_OVERRIDE_<AGENT_NAME>` requires no
code change at all.

**8. Every call is metered.** Agent, provider, model, tokens in/out, cost,
latency and cache-hit status go to `UsageLog`.

---

## 6. Frontend working principles

**1. Signal is the design system.** `frontend/src/signal/tokens.js` is the
single source for palette and type: light-first, one indigo accent
(`#3A2BD9`), semantic green/amber/red, IBM Plex Sans and Mono. Shared
primitives live in `frontend/src/signal/ui.jsx`.

**2. Mono is the instrument.** Monospace carries every number, label and
score; the sans face carries prose. Data reads as data.

**3. Provenance is visible.** Each score row renders a `LOCAL` or `MODEL`
badge from `ScoreCategory.source`. Roadmap items show confidence. This is the
UI expression of principle 2 in §1.

**4. Never invent precision.** Estimated point values appear only where the
backend produced them (roadmap items). Missing keywords show priority and
where to fix — not a fabricated point value, because the per-keyword figure in
the report screen is a presentational heuristic, not a real score input.

**5. One mapping seam.** `mapScanToReportData()` converts the API payload into
view data. Components never reach into `scan.details.*` directly, so a backend
field rename touches one function.

**6. Heavy work happens client-side where it can.** PDF text extraction runs
in the browser via pdf.js, so an unreadable scanned PDF is caught before any
request is sent — and costs nothing.

**7. The report is shareable.** `/report/:scanId` is deliberately outside the
auth gate so a WhatsApp deep link opens it directly.

---

## 7. UI flow

```
Landing / Sign in
      ↓
Onboarding  (experience + target tier — both feed the scoring)
      ↓
Dashboard  ──►  "What do I do next?"
      ↓
Analyze  (resume + JD + tier + experience, one screen)
      ↓
Processing  (staged, honest — 3 waves)
      ↓
┌─────────────────────────────────────────┐
│ REPORT                                  │
│  Overview → Score → Keywords            │
│  → Quality → Fixes → Prep 🔒            │
└─────────────────────────────────────────┘
      ↓
Optimize  (change-by-change review)
      ↓
Verify  (accept / reject / edit; flagged claims surfaced)
      ↓
Re-scored automatically → Before / After
      ↓
Interview prep  (grouped by weak area)
      ↓
Download → Apply
```

The product loop the whole interface serves:

```
ANALYZE → UNDERSTAND → FIX → VERIFY → RE-SCAN → PREPARE → APPLY
```

### Headline scores

The three rings are **Match** (`score.generic`), **Portal score**
(`score.naukri`, with the gap and its reason), and **Resume quality**. There is
deliberately no "interview readiness" ring — nothing in the pipeline measures
it, and fabricating the most prominent number on the most important screen
would undercut the product's core claim.

Full screen-by-screen structure, wireframes, empty/error/loading states and
component hierarchy: [`frontend/UX-CONTRACT.md`](frontend/UX-CONTRACT.md).

---

## 8. Features today

**Analysis**
- Match score with a five-category breakdown, each showing points earned,
  points lost, a plain-language reason and its provenance
- Naukri portal score and an explanation of the gap versus the generic score
- Exact keyword match vs semantic match, shown separately
- Missing requirements with priority and where to add them
- Found keywords, overused phrases
- Per-section quality scores and weak-bullet diagnosis with suggested fixes
- Ranked fix roadmap with estimated gain and confidence
- Tier calibration and fresher mode

**Optimization**
- AI rewrite driven by the roadmap, with a change summary
- Verification of every claim against the original
- Automatic re-score of the rewritten resume
- Recruiter's first-impression comment *(generated, not yet surfaced in the UI)*

**Interview preparation**
- Technical and HR questions, each with why it will be asked

**Platform**
- Email/password accounts with rotating refresh tokens
- Scan report, dashboard with next-step guidance and history
- 30-day result caching; per-call cost telemetry

---

## 9. Plan and phase status

| Phase | Goal | Status |
|---|---|---|
| **0 — Foundation** | Scaffold, schema, LLM abstraction | **Done** |
| **1 — Prototype** | End-to-end scan proving the wedge | **Done in code.** Real-user validation not done |
| **2 — Core product** | Rewrite, verify, prep, frontend | **Mostly done.** See pending |
| **3 — Monetisation** | Payments, credits, WhatsApp, referral | **Not started** |

**Phase 1's real exit criterion was never a code milestone** — it was testing
with 20–30 real users, and it is the kill switch the rest of the plan is gated
on. That has not happened. The pipeline working is necessary, not sufficient.

---

## 10. What is built — verified by running it

The system was launched and driven end to end, not just typechecked.

| Check | Result |
|---|---|
| Backend boots, all routes mapped | ✅ |
| Postgres + pgvector, schema migrated | ✅ |
| Redis connected | ✅ |
| Full scan: resume + JD → report | ✅ **HTTP 201 in ~30s** |
| Parsing, scoring, roadmap coherent | ✅ 43 generic / 48 Naukri, 7 missing keywords, 6 weak bullets, 4 roadmap items |
| Report screen renders live data | ✅ no app console errors |
| Sign-up → JWT → dashboard | ✅ driven in a real browser |
| Production build | ✅ clean |

**Backend:** all 14 agents, both pipelines, `POST /scan`, `GET /scan/:id`,
`POST /scan/:id/rewrite`, `GET /scan/:id/diff`,
`GET /scan/:id/interview-prep`, and `/auth/register|login|refresh`.

**Frontend:** upload screen, scan report (Score / Keywords / Quality / Fixes),
sign-in, dashboard, shared Signal primitives.

---

## 11. What is pending

### Blocking a real launch

1. **No tests run.** `npm test` invokes jest, but **there are no test files.**
   Fifteen agents export `goldenTests` arrays that nothing executes. The
   safety-critical behaviour — `VerifyAgent` refusing hallucinated claims — has
   no automated coverage at all. This is the most serious gap in the project.
2. **No real-user validation.** Phase 1's actual exit criterion.
3. **No auth guard on `/scan`.** `Scan.userId` is always null, so scans belong
   to nobody. The dashboard currently tracks scan IDs in browser localStorage
   as a stopgap.
4. **Credit gating is inert.** The ledger tables exist and nothing writes to
   them, so free/paid limits cannot be enforced and the "your credit was not
   used" messaging is unbacked.

### Product correctness

5. **Re-score reflects the model's full rewrite, not the user's accepted
   subset.** If a user rejects a change, the "after" score describes a resume
   they did not accept. `ScanPipeline.runFromStructured()` already does the
   right thing internally and needs a route.
6. **No progress signal.** `POST /scan` returns only when all three waves
   finish, so a staged progress screen has no data behind it.
7. **Interview prep is gated behind rewrite** by the data model —
   `InterviewPrepSet` rows are only written during a rewrite.

### Known defects

8. `ATSScanReport.jsx:160` — the Naukri gap panel is hardcoded to critical red.
   When the portal score is *higher*, good news renders as a problem.
9. `ATSScanReport.jsx:42` — tier renders as `Mnc` / `Psu`. Fixed in the
   dashboard via a shared `tierLabel` helper; the report still needs it.
10. `tokens.js:30` imports IBM Plex from Google Fonts at runtime. If that host
    is unreachable the app silently falls back to system fonts. Self-host the
    woff2.

### Not started

11. Razorpay payments, GST treatment decision
12. WhatsApp receiver — env vars exist, no code. Business verification has a
    multi-week lead time
13. `ReferralMessageAgent` is written but reachable from no endpoint
14. `RecruiterCommentAgent` output is generated on every rewrite and then
    discarded by the UI — already paid for, not shown
15. Screens not built: landing, onboarding, optimize/verify, before-after,
    interview prep, scan library, version history, settings
16. Verified pricing. `RATE_CARD` has `0.0` placeholders for every Gemini
    model, so all cost telemetry currently computes **zero**
17. **Government tier is an unresolved product decision.** Currently scoped to
    structural guidance only

---

## 12. Future features

**Near term**
- Selective re-score endpoint; auth guard and a real scan list
- Payments, credits, and enforced free/paid tiers
- WhatsApp scanning with deep links into the web report
- Self-hosted fonts; the remaining screens

**Medium term**
- **Practice answers** — the prep screen already reserves the affordance
- **Interview readiness as a measured score**, computed as gap coverage once
  per-question progress is tracked
- **Resume entity with cross-job version lineage.** Today `ResumeVersion`
  belongs to a `Scan`, so a resume used for three jobs has three unrelated
  histories
- **Application tracking** — required before the dashboard can honestly count
  applications and interviews
- Multi-provider routing restored; a real rate card
- Referral flow using the agent that already exists

**Longer term**
- Campus and placement-cell accounts (bulk scanning, cohort analytics)
- Portal-specific scoring beyond Naukri
- Recruiter-side view
- Score simulation — "what if I add Docker?" before committing to a rewrite
- Regional language support

---

## 13. Running it

**Prerequisites:** Postgres with pgvector, Redis, and at least one LLM key.

```bash
# infrastructure (ports match backend/.env)
docker run -d --name parse-postgres -e POSTGRES_PASSWORD=<pw> \
  -e POSTGRES_DB=parse_dev -p 5434:5432 pgvector/pgvector:pg17
docker run -d --name parse-redis -p 6380:6379 redis:7-alpine
docker exec parse-postgres psql -U postgres -d parse_dev \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# backend
cd backend && cp .env.example .env   # fill DATABASE_URL, REDIS_URL, one LLM key
npm install && npx prisma migrate dev --name init
npm run start:dev                    # :3000 by default

# frontend
cd frontend && npm install && npm run dev   # :5173, proxies /api → :3000
```

If the default ports are taken, override both — the proxy target is
configurable:

```bash
PORT=3001 npm run start:dev
VITE_API_ORIGIN=http://localhost:3001 npx vite --port 5188 --strictPort
```

**Verified environment note:** only `GEMINI_API_KEY` is provisioned, so
`model-routing.ts` sends every agent to Gemini. The safety-critical
`RewriteAgent` and `VerifyAgent` therefore run on a flash-class model rather
than a dedicated reasoning tier. Worth revisiting before launch.
