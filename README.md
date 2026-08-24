# PARSE// — AI Resume Intelligence for the Indian Job Market

> **This is the single source of truth for PARSE//.** It supersedes and replaces
> the former `PROJECT.md`, `PROJECT_DOCUMENTATION.md`, `DESIGN-AND-ROADMAP.md`,
> `BUILD-LOG.md`, `frontend/UX-CONTRACT.md`, and any `MASTER-DOCUMENTATION.md` /
> `PARSE_Master_Plan.md`. Every claim here is stated as it is **in the code
> today**; where the older docs disagreed, the code wins (see
> [Appendix A](#appendix-a--provenance--corrected-claims) for the specific
> corrections). Keep this file current.

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Status at a glance](#2-status-at-a-glance)
3. [Requirements & scope](#3-requirements--scope)
4. [Architecture](#4-architecture)
5. [API reference](#5-api-reference)
6. [Authentication](#6-authentication)
7. [Design system ("Signal")](#7-design-system-signal)
8. [User flows](#8-user-flows)
9. [Screens & routes](#9-screens--routes)
10. [Feature-by-feature status](#10-feature-by-feature-status)
11. [Open decisions, defects & blockers](#11-open-decisions-defects--blockers)
12. [Running it locally](#12-running-it-locally)
13. [Testing plan](#13-testing-plan)
14. [Roadmap](#14-roadmap)
15. [Launch checklist](#15-launch-checklist)
16. [Build history](#16-build-history)
17. [Open questions for the team](#17-open-questions-for-the-team)
18. [Glossary](#18-glossary)
- [Appendix A — Provenance & corrected claims](#appendix-a--provenance--corrected-claims)

---

## 1. What it is

PARSE// analyses a candidate's **existing** resume against **one specific job
description**, explains where it falls short with per-category evidence, produces
a ranked fix roadmap, optionally rewrites the resume under a hallucination guard,
re-scores it, and generates interview questions from the gaps.

It is **not** a resume builder and **not** a job board. The question it answers:

> **Why didn't I get the interview, and what specifically do I change?**

### The motive

Job seekers do not want a better-looking resume. They want an interview. Most
resume tools sell polish — templates, fonts, phrasing — which solves a problem
candidates do not have. The real failure is invisible: a resume is filtered out
before a human reads it, and the candidate never learns why. PARSE// exists to
make that filter visible and then fix it.

### Three constraints that shape every technical decision

1. **Diagnose against a specific JD.** A resume is never good or bad in the
   abstract — only a match or mismatch for one posting. Every analysis takes a
   resume *and* a JD.
2. **Show the working.** Every number carries its provenance: `LOCAL` for
   arithmetic computed in code, `MODEL` for a judgement made by an LLM. A score
   nobody can interrogate is a horoscope.
3. **Never invent experience.** The rewrite may sharpen *how* a candidate says
   what they did; it may not invent *what* they did. Enforced in code by a
   fail-closed verifier — not by prompt politeness.

### Why India specifically

- **Portal-first hiring.** Naukri and similar portals rank resumes with their own
  parsers, which behave differently from a US-style ATS. A resume can score well
  generically and still be filtered by the portal that actually gates the job.
- **Four employer tiers** (Startup / MNC / PSU / Government) that screen for
  genuinely different things. One rubric across all four is wrong for at least
  three of them.
- **Freshers are the volume segment**, and are penalised by scoring that treats
  years of experience as the primary signal when projects are the real evidence.

These are first-class pipeline inputs, not settings buried in a menu.

### The product loop

```
ANALYZE → UNDERSTAND → FIX → VERIFY → RE-SCAN → PREPARE → APPLY
```

---

## 2. Status at a glance

**Built and working (verified by running it):**
Both pipelines · all 14 agents · 11 REST endpoints · email auth with rotating
refresh tokens · Redis result cache · pgvector embedding cache · full design
system (~20 components, self-hosted IBM Plex) · landing → auth → onboarding →
dashboard → analyse → 6-panel report. A live `POST /scan` returns HTTP 201 in
~30s with coherent parsed output, a real weighted score, and a sensible roadmap.

**Partial:**
Google SSO (wired, inert until credentials set; callback returns JSON instead of
redirecting) · `RecruiterCommentAgent` (runs on every rewrite, then discarded —
never reaches UI) · `InterviewPrepAgent` (produces data, no dedicated UI) ·
`GET /scan/:id/interview-prep` (404s until a rewrite has run) · streaming/staged
loading (pipeline resolves fully before responding).

**Not started:**
Credits · payments (Razorpay) · WhatsApp receiver · referral flow · resume
library · **any tests** · CI/CD · deployment path · error monitoring · analytics
transport.

### Final status by area

| Area | Status |
|---|---|
| Backend core — pipelines, agents, scoring | **Advanced** — runs end to end, unverified by tests |
| Frontend analysis experience | **Advanced** — complete and responsive |
| Design system | **Near complete** |
| Authentication | **In progress** — email solid; Google inert; no recovery, no logout |
| Optimization experience | **Early** — backend done, UI is one button |
| Interview prep | **Early** — backend done, no UI |
| Credits & payments | **Not started** |
| Testing | **Not started** |
| Deployment & CI/CD | **Not started** |
| Observability | **Early** — telemetry rows written, cost reads 0, no monitoring |

**Overall: a working prototype with a production-quality analysis experience, and
no test, payment, or deployment infrastructure.**

---

## 3. Requirements & scope

### 3.1 Functional requirements

| # | Requirement | Status |
|---|---|---|
| FR-1 | Resume ingestion — PDF/DOCX/TXT → text | **Partial** — PDF via client-side pdf.js; DOCX advertised then rejected |
| FR-2 | JD ingestion — pasted text | Built |
| FR-3 | Structured parsing of resume and JD | Built |
| FR-4 | Deterministic checks — keywords, formatting, metrics, contact | Built, **zero model cost** |
| FR-5 | Semantic matching — meaning, not literal keywords | Built (+ pgvector) |
| FR-6 | Caching — identical inputs must not re-bill | Built (Redis, 30-day TTL, options in key) |
| FR-7 | Quality assessment — section scores, weak bullets | Built |
| FR-8 | Hallucination guard — every claim traceable to the original | Built (`VerifyAgent`) |
| FR-8a | …and it must **fail closed** | Built — returns original + flagged claims |
| FR-9 | Portal score + gap explanation | Built; numeric gap computed downstream |
| FR-10 | Tier calibration — Startup/MNC/PSU/Government | Built |
| FR-11 | One 0–100 score with per-category breakdown | Built, **no model call** |
| FR-12 | Ranked fix roadmap with estimated gain + confidence | Built |
| FR-13 | AI rewrite against the roadmap | Built |
| FR-14 | Re-score the rewritten resume | Built |
| FR-15 | Interview prep from resume + JD + gaps | Built — **no UI**; only produced during a rewrite |
| FR-16 | Recruiter first-impression comment | Built — **generated every rewrite, never persisted** |
| FR-17 | Accounts — email/password + Google SSO | **Partial** — email works; Google inert |
| FR-18 | Cost telemetry — model, tokens, cost, latency | Built — **cost always reads 0** (see FR-21) |
| FR-19 | Client-side score simulation ("what if I add X") | Built; projects onto Match, not Naukri |
| FR-20 | Credit gating — free limits, paid unlock | **Not built** — tables exist, nothing writes |
| FR-21 | Verified per-token rate card | **Not done** — `RATE_CARD` is `0.0` for every routed model |
| FR-22 | Payments — Razorpay + GST treatment | **Not built** — env vars reserved only |
| FR-23 | WhatsApp scanning + deep link to report | **Not built** — report route already public to support it |
| FR-24 | Referral message generation | Built — **wired to no endpoint** |

### 3.2 Non-functional requirements

- **Reliability** — a rewrite must never ship an unverifiable claim. Hard
  requirement, not best-effort. *Met in code, unverified by tests.*
- **Cost** — every model call logged with token counts so unit economics are
  measurable rather than assumed. *Logging built; rates are placeholders, so
  measured cost is 0.*
- **Latency** — a scan should complete well under a minute. *Measured live: ~30 s.*
- **Availability** — cache and rate limiting degrade gracefully; Redis being down
  must not break a scan. *Met; the limiter fails **open**.*
- **Provider independence** — no agent may be coupled to one LLM vendor. *Met
  structurally — three providers implemented; only Gemini is routed to today.*
- **Accessibility** — meaning never in colour alone; keyboard-operable;
  reduced-motion honoured.
- **Security** — *Partial.* See [§11](#11-open-decisions-defects--blockers).

### 3.3 In scope (v1)

- Resume + JD ingestion (paste; PDF parse on the client)
- Diagnostic scan: score, per-category evidence, keyword ledger, roadmap
- Verified rewrite with before/after re-score
- Interview prep generated from gaps
- India-specific tiering and fresher handling
- Email auth, scan history; anonymous scans supported (share via link)

### 3.4 Explicitly out of scope

- **A resume builder or template gallery.** The product analyses a resume the
  candidate already has.
- **A job board.** PARSE// does not source or list jobs.
- **Voice or video mock interviews.** Prep is written questions and reasoning.
- **Auto-apply.** The product ends at "you are ready to apply".
- **Generic AI chat.** No open-ended assistant surface.
- **LinkedIn / profile optimisation.** Resume and JD only.
- Dark mode · multi-portal scoring beyond Naukri · regional languages.

---

## 4. Architecture

Two-tier: a React SPA talking REST to a NestJS monolith with a wave-based
multi-agent LLM orchestrator inside it.

```
                    Browser (React 18 + Vite 5)
                             │  /api/*  (Vite dev proxy, rewrites away /api)
                             ▼
                    NestJS 10 API ── ScanController · AuthController
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
          Anthropic       OpenAI         Gemini   ← only Gemini keyed today
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  Postgres + pgvector      Redis              UsageLog
  scans, versions,     cache + rate       per-call cost
  users, ledger        limiting (UNUSED)   and latency
```

> ⚠️ **No queue, no worker process, no background jobs.** `POST /scan` runs the
> entire pipeline **synchronously inside the HTTP request**, holding the
> connection open ~30 s.

### 4.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18.3, Vite 5.4, React Router 6.26 | **Plain JSX — no TypeScript** |
| Styling | Plain CSS + custom properties | No Tailwind, no CSS-in-JS |
| State | React Context + `useState` | **No React Query/SWR** — server state hand-rolled |
| Forms / charts | Native elements; hand-built SVG + CSS | No form or chart library |
| PDF | `pdfjs-dist` 6.2 | Client-side text extraction |
| Icons | `lucide-react` 1.31 | |
| Fonts | `@fontsource/ibm-plex-sans` / `-mono` 5.3 | Self-hosted, bundled by Vite |
| Backend | NestJS 10.4, TypeScript | `package.json` declares `^5.5.4`; resolves to **5.9.3** |
| ORM | Prisma 7.9 + `@prisma/adapter-pg` | Prisma 7 removed `url` from the schema |
| Database | PostgreSQL + **pgvector** (`pgvector/pgvector:pg17`) | `vector(1536)` |
| Cache | Redis 7 via `ioredis` 5.4 | |
| Validation | `class-validator` (DTOs) · **Zod** (LLM output) | Zod is load-bearing |
| Auth | Passport `passport-jwt` + `passport-google-oauth20`, `@nestjs/jwt`, `bcryptjs` | |
| LLM SDKs | `@google/genai` 2.16 (routed) · `@anthropic-ai/sdk` 0.32 · `openai` 4.67 (unrouted) | |
| Queue | **none** | |
| Infra | **none** | No Dockerfile, compose, CI, or deploy config |

### 4.2 Repository layout

```
backend/
├── prisma/schema.prisma       10 models — the real contract
├── prisma.config.ts           CLI datasource URL (Prisma 7)
└── src/
    ├── main.ts                bootstrap, CORS, ValidationPipe, usage sink
    ├── app.module.ts          ConfigModule + ScanModule + AuthModule — that is all
    ├── agents/                16 files: 14 agents + types.ts + _template.ts
    ├── orchestrator/          scan-pipeline.ts, rewrite-pipeline.ts
    ├── llm/                   llm-provider.ts, model-routing.ts, types.ts, providers/
    ├── auth/                  controller, service, strategies, guards, DTOs
    ├── scan/                  controller, service, module, DTOs
    ├── vector/                pgvector.store.ts, embed.ts
    └── common/                prisma.service.ts, redis.service.ts, usage-logger.ts

frontend/src/
├── main.jsx                   entry — loads design system, mounts ToastProvider
├── App.jsx                    routes, auth gate, shell selection
├── design-system/             tokens.css/.js, base.css, index.js barrel, components/
├── signal/                    LEGACY tokens + ui — used only by SignIn
├── layouts/                   AppShell, PublicShell
├── features/analysis/         AnalyzePage, ProcessingState, ReportPage, reportData, panels/
├── pages/                     Landing, Onboarding, DesignSystemPreview
├── screens/                   Dashboard, SignIn  (legacy folder, being retired)
├── contexts/AuthContext.jsx   the only session source
├── hooks/useMediaQuery.js     useIsMobile / useIsCompact
├── components/ErrorBoundary.jsx
├── api/client.js              fetch wrapper, session, refresh-on-401
└── services/analytics.js      event taxonomy; console-only
```

### 4.3 Backend modules

NestJS monolith. Only **three** modules are registered in `app.module.ts`.

| Module | Purpose | Endpoints | Status |
|---|---|---|---|
| `AppModule` | Root; `ConfigModule.forRoot({ isGlobal: true })` | — | Implemented |
| `AuthModule` | Register, login, refresh rotation, Google SSO | 5 | **Partial** — Google inert without credentials |
| `ScanModule` | Scan lifecycle, listing, rewrite, diff, prep | 6 | Implemented |
| *Users / Credits / Payments / Interview / Dashboard* | — | — | **Not implemented as modules** |

> ⚠️ `PrismaService` and `RedisService` are re-provided in **both** `ScanModule`
> and `AuthModule` rather than in a shared global module — so each gets its own
> connection pool. Two Prisma pools against a managed Postgres with a
> ~20-connection cap is a real production failure mode.

**Present:** controllers, services, modules, guards, DTOs, a global
`ValidationPipe({ whitelist: true, transform: true })`.
**Not implemented:** custom middleware, interceptors, exception filters,
role-based authorization, queue layer. Errors propagate to Nest's default handler.

**Request flow:**

```
HTTP request
 ↓ Controller (ScanController | AuthController)
 ↓ Guard      OptionalJwtGuard (attaches user, never rejects)
              JwtAuthGuard     (rejects without a valid token)
 ↓ ValidationPipe → DTO
 ↓ Service (ScanService | AuthService)
   ├── RedisService   cache lookup / write
   ├── PrismaService  persistence
   └── Pipeline → agents → completeStructured() → Gemini
 ↓ JSON response
```

### 4.4 Agents

`backend/src/agents/` — 16 files: **12 LLM agents, 2 pure-code units**, plus
`types.ts` and a doc-only `_template.ts`. Two do real work with **no model call
at all**, which matters for both cost and trust.

| Agent | Purpose | Tier | Kind | Status |
|---|---|---|---|---|
| `ParseResumeAgent` | Raw text → `ParsedResume` | cheap | LLM | Implemented |
| `ParseJDAgent` | Raw text → `ParsedJD` | cheap | LLM | Implemented |
| `DeterministicCheckAgent` | Keywords, metrics, verbs, contact, gaps | — | **pure code, 0 cost** | Implemented |
| `SemanticMatchAgent` | Meaning-level match, seniority/domain fit | mid | LLM + pgvector | Implemented |
| `QualityAgent` | Section scores, weak bullets | mid | LLM | Implemented |
| `NaukriScoreAgent` | Portal score + gap reason | cheap | LLM | Implemented |
| `TierCalibrationAgent` | Startup/MNC/PSU/Government adjustment | cheap | LLM | Implemented |
| `ScoreAggregator` | Final weighted score + categories | — | **pure arithmetic** | Implemented |
| `RoadmapAgent` | Ranked fixes with gain + confidence | frontier | LLM | Implemented |
| `RewriteAgent` | Improved resume + change summary | frontier | LLM | Implemented |
| `VerifyAgent` | Trace every claim back to the original | frontier | LLM | Implemented |
| `RecruiterCommentAgent` | Six-second recruiter read | mid | LLM | **Partial** — discarded, no UI |
| `InterviewPrepAgent` | Technical + HR questions with reasons | cheap | LLM | **Partial** — no UI |
| `ReferralMessageAgent` | Referral message text | cheap | LLM | **Partial** — no endpoint |

**Prompts.** There is **no prompts directory and no template files.** Every prompt
is a `buildPrompt()` function inside its own agent file, co-located with the Zod
`OutputSchema` it must satisfy. No prompt versioning, no registry, no A/B testing.
`_template.ts` is a scaffold for writing new agents in the same shape.

**Golden tests.** 15 files export a `goldenTests` array (one is `_template.ts`).
**Only 4 contain real fixtures** — `parse-resume`, `parse-jd`,
`deterministic-check`, `score-aggregator`. The other 10 are
`Array<{note: string}>` prose placeholders. The arrays also use **four
incompatible shapes**, so a single generic runner is not a small job. **Nothing
executes any of them.**

### 4.5 Scan pipeline (`orchestrator/scan-pipeline.ts`)

3 waves, ~7 LLM calls. Parallel within a wave, sequential between.

```
Wave 1  ParseResume ∥ ParseJD                                    2 calls
        → pgvector embed + cosine candidate search (threshold 0.6)
Wave 2  DeterministicCheck(0) ∥ Semantic ∥ Quality
        ∥ Naukri ∥ TierCalibration                               4 calls
        → ScoreAggregator (pure arithmetic)                      0 calls
Wave 3  Roadmap (needs the score as input)                       1 call
        → ScanPipelineResult
```

Two entry points: `run()` from raw text, and `runFromStructured()` from
already-parsed objects — the latter is what the rewrite pipeline re-scores
through, and what a future rescan endpoint would reuse.

**Failure model:** any agent exception propagates; `ScanService` marks the scan
`FAILED` with the message and rethrows. There is **no per-agent fallback or
partial-result path** — one failed agent fails the whole scan.

**Context passing:** plain typed objects (`src/agents/types.ts`). No shared
mutable state, no conversation memory.

### 4.6 Rewrite pipeline (`orchestrator/rewrite-pipeline.ts`)

```
RewriteAgent
   ↓
VerifyAgent ──passed──→ parallel: ScanPipeline.runFromStructured()
   │                            ∥ RecruiterCommentAgent
   │                            ∥ InterviewPrepAgent
   │                              ↓ { status:"verified", resume, changeSummary,
   │                                  rescored, recruiterComments, interviewPrep }
   └──failed──→ re-prompt RewriteAgent with the flagged claims
                (up to maxRetries = 2)
                     ↓ still failing
                { status:"verification_failed", resume: THE ORIGINAL, flaggedClaims }
```

**On exhaustion it returns the original resume plus flagged claims — never the
unverified rewrite.** This fail-closed behaviour is the product's central claim.
An earlier design failed *open* — it shipped the unverified rewrite once retries
were exhausted, directly contradicting the reliability requirement. **Do not
"simplify" this loop.**

Best case ≈9 LLM calls. **Worst case (3 rewrite + 3 verify) makes 6 sequential
calls on the FRONTIER model** — see the rate-limit warning in
[§4.9](#49-llm-provider--routing-llm).

### 4.7 Scoring engine (`agents/score-aggregator.ts`)

**No LLM produces the final number.** The model supplies *inputs*; the score is
fixed-weight arithmetic, which is what makes per-category source labelling honest
and the score reproducible.

```
WEIGHTS = { keyword: 30, experience: 20, bullets: 20, structure: 15, contact: 15 }
```

| Category | Formula | Source |
|---|---|---|
| Keyword coverage | `round(exactMatchPct/100 × 30)` | `code` |
| Experience fit | `round(experienceFitScore/100 × 20)` | `llm` |
| Bullet quality | `round(bulletQualityScore/100 × 20)` | `llm` |
| Structure | `round(sectionsPresent/5 × 15)` (summary, experience, projects, skills, education) | `code` |
| Contact & format | `contactValid ? 15×0.7 : 15×0.2` + `(fieldsPresent/4) × 15×0.3`, capped at 15 | `code` |

`generic = Σ earned` (max 100). Each category carries
`{earned, max, reason, source}`.

**Separately produced, not part of the sum:**
- `naukri` — `NaukriScoreAgent`, model-estimated
- `exactMatch` — `found / uniqueJdSkills × 100`, deterministic
- `semanticMatch` — `SemanticMatchAgent`, model-estimated
- `gapReason` — model-written explanation of the portal gap

**Deterministic checks** (`deterministic-check.agent.ts`): contact validity (email
contains `@`, phone ≥10 digits), word count, timeline gaps >6 months, action-verb
density, metric-bearing bullet ratio, exact keyword match over unique JD skills,
missing keywords with `priority` (`critical` if a must-have, else `important`) and
a `where` hint, and overused weak openers ("responsible for", "worked on",
"helped", "involved in", "assisted with").

**Derived in the frontend, not the backend:**
- **Per-keyword impact** = `keywordCategory.max / totalJdSkills` (in
  `reportData.js`). For a 10-requirement posting that is **+3.0 points**, badged
  `LOCAL`. Derived from the two formulas above, not estimated. The roadmap's
  larger `gain` is the model's estimate, badged `MODEL` with its `conf` — usually
  higher, because adding Docker also improves semantic match and bullet quality.
  The two are shown as separate, differently-badged numbers on purpose. The old
  `PRIORITY_GAIN` constant was presentational and should be deleted.
- **Resume quality ring** = mean of `quality.sections[].score`, falling back to
  `bulletQualityScore`. Badged `MODEL`.

**Thresholds** (`design-system/tokens.js`): `<55` critical · `<75` warning ·
`≥75` good, with `scoreLabel()` producing "Weak match" / "Partial match" /
"Strong match" for screen readers.

### 4.8 AI safety

| Safeguard | Implementation | Status |
|---|---|---|
| Structured-output validation | Zod schema per agent, one corrective retry, then throw | Implemented |
| Claim traceability | `VerifyAgent` compares rewritten vs original | Implemented |
| Fail-closed | On exhausted retries the pipeline returns the **original** resume plus flagged claims | Implemented |
| Original preservation | The `kind:"original"` `ResumeVersion` is written at scan time and never mutated | Implemented |
| Unverified output marking | Failed rewrites stored with `verified: false` and `flagged` populated | Implemented |
| Provenance surfaced to the user | `source: "code" \| "llm"` → LOCAL/MODEL on every score row | Implemented |
| Confidence surfaced | `RoadmapItem.conf` rendered as bars + word | Implemented |
| Targeted number/date/company checks | — | **Not implemented** as discrete checks |
| Automated hallucination testing | — | **Not implemented** |

> ⚠️ **This system is not hallucination-proof.** Verification is itself an LLM
> judgement, currently running on a flash-class model, with no test suite
> measuring its precision or recall.

### 4.9 LLM provider & routing (`llm/`)

Every agent calls exactly one function — no agent imports a vendor SDK:

```ts
completeStructured(prompt, zodSchema, agentName, { scanId, modelOverride? })
```

1. Resolve the model — env override → explicit override → `MODEL_ROUTING`
2. Call the provider (with transient-error retry, see below)
3. Strip code fences, `JSON.parse`, validate against the Zod schema
4. On failure: **exactly one corrective retry**, telling the model what was wrong
5. On a second failure: **throw** — a malformed object never reaches downstream code
6. Emit usage to the sink → a `UsageLog` row

**Anthropic and OpenAI providers are complete and functional — just unrouted.**
All three tiers currently point at Gemini:

| Tier | Model (today) | Agents |
|---|---|---|
| CHEAP | `gemini-3.5-flash-lite` | Parse×2, Naukri, Tier, InterviewPrep, Referral |
| MID | `gemini-3.6-flash` | Semantic, Quality, RecruiterComment |
| FRONTIER | `gemini-3.5-flash` | Roadmap, **Rewrite**, **Verify** |
| none | — | DeterministicCheck, ScoreAggregator — pure code |

Per-agent override needs no code change; the env var wins over both the explicit
override argument and the table:

```bash
MODEL_OVERRIDE_REWRITE_AGENT="anthropic:claude-haiku-4-5-20251001"
MODEL_OVERRIDE_VERIFY_AGENT="gemini:gemini-3.1-pro-preview"
```

> **Note:** the safety-critical `RewriteAgent`/`VerifyAgent` currently run on a
> **flash-class** model, not a dedicated reasoning tier.
> `gemini-3.1-pro-preview` is available on the current key and is a one-line
> routing change. See [§11](#11-open-decisions-defects--blockers).

#### Verified live constraints

A direct API probe confirmed:

- **All three routed models work.** All 12 agents pass end-to-end through the real
  code path; `embedTerms()` returns 1536 dims.
- **The key is on the FREE tier**, with per-model per-minute request quotas:

  | Model | RPM |
  |---|---|
  | `gemini-3.5-flash-lite` | **15** |
  | `gemini-3.6-flash` | **5** |
  | `gemini-3.5-flash` | **5** |

  A scan uses 2 calls on the 5-RPM MID model → **~2.5 scans/minute, roughly two
  concurrent users** before 429s. A failing rewrite makes 6 sequential calls on a
  5-RPM model and **can exhaust the quota by itself.**
- **`gemini-2.5-pro` returns 404**, not a quota error: *"no longer available to
  new users… use `models/gemini-3.1-pro-preview`"*.
- 429 bodies carry a `RetryInfo.retryDelay` hint (~5 s) that the current backoff
  does not honour.

#### Embeddings — a separate, harder dependency

| Property | Value |
|---|---|
| Provider | **Gemini only** — `embedTerms()` throws without `GEMINI_API_KEY`, regardless of `MODEL_ROUTING` |
| Dimensionality | **1536**, requested explicitly via Matryoshka truncation to match the fixed `vector(1536)` column |
| Caching | `SkillEmbedding`, keyed on the normalised term |
| Known SDK trap | A flat `contents: string[]` is treated as *parts of one content* and returns a single **averaged** vector. Each term must be wrapped as its own `{ parts: [{ text }] }` |

Changing the embedding provider or dimensionality requires a **migration** of the
`vector(1536)` column and re-embedding the cache. **This is the least swappable
LLM dependency in the system.**

#### Cost telemetry

| Key | in / out (USD per 1K tokens) |
|---|---|
| `gemini:gemini-3.5-flash-lite` | **0.0 / 0.0** — placeholder |
| `gemini:gemini-3.6-flash` | **0.0 / 0.0** — placeholder |
| `gemini:gemini-3.5-flash` | **0.0 / 0.0** — placeholder |
| `openai:gpt-4o-mini` | 0.00015 / 0.0006 |
| `openai:gpt-4o` | 0.0025 / 0.01 |
| `anthropic:claude-haiku-4-5-20251001` | 0.001 / 0.005 |

**Consequence: every `UsageLog.costUsd` for a real scan is 0.** Token counts and
latencies are real; the money column is not. Unit-economics claims cannot be made
until BE-10 lands.

#### Failure modes

| Failure | Behaviour today |
|---|---|
| No key for the routed provider | `completeStructured()` throws clearly; scan marked `FAILED` |
| Malformed JSON / schema mismatch | One corrective retry, then throw. **A malformed object never travels downstream** |
| Network failure mid-scan | Observed live (`fetch failed`). Backend correctly marked the scan `FAILED` |
| Model deprecated / zero quota | Hard failure. **Has happened twice on this key — treat model ids as volatile config, not constants** |
| Verification cannot pass | Fails closed: original resume + flagged claims |

> **Uncommitted local change:** `llm/llm-provider.ts` has an unreviewed +33-line
> transient-retry (429/5xx with exponential backoff + jitter) around
> `callProvider`, added after a live Gemini 503 killed a scan. Typechecks clean;
> decide review/commit/revert.

### 4.10 Data model (10 Prisma models, 3 enums)

```
User
 ├── RefreshToken      hashed token, revokedAt, expiresAt
 ├── CreditLedger      append-only running balance — NO WRITES ANYWHERE
 ├── Transaction ──→ PricingVariant      NO WRITES ANYWHERE
 └── Scan   (userId nullable — anonymous scans supported)
       ├── ResumeVersion     kind: "original" | "rewritten"; verified, flagged, diff
       └── InterviewPrepSet  technical[], hr[]
SkillEmbedding   standalone — normalizedTerm (unique) → vector(1536), shared across users
UsageLog         standalone — per-LLM-call telemetry, scanId optional
```

**Design points**

- `Scan` stores all pipeline output as **JSON columns** (`resumeParsed`,
  `jdParsed`, `score`, `roadmap`, `naukri`, `details`) rather than normalised
  tables — the shapes are model-defined and change with prompts. Trade-off: they
  are unqueryable, which will block score-history analytics later.
- `Scan.cacheKey = sha256(resume + jd + tier + fresherMode)`. **The options must
  be in the key** — a resume scored as PSU is not the same scan as one scored as
  Startup. A collision here would bill a PSU scan as a Startup scan.
- `CreditLedger` is append-only with a running balance, never a mutable integer —
  correct design, entirely unused.
- `SkillEmbedding.normalizedTerm` is unique so embeddings are shared across users;
  skill terms repeat heavily.

**Indexes:** `User.email`, `RefreshToken.userId`, `Scan.cacheKey`, `Scan.userId`,
`ResumeVersion.scanId`, `InterviewPrepSet.scanId`, `SkillEmbedding.normalizedTerm`,
`CreditLedger.userId`, `Transaction.userId`, `UsageLog.agentName`, `UsageLog.scanId`.

**Migrations:** Prisma Migrate. `_prisma_migrations` exists in the live database
and all 10 tables are present. **No seed script exists.**

**Dead schema elements:**
- `ScanStatus.PENDING` is the column default and is **never written** — rows are
  created directly as `RUNNING`.
- `UsageLog.cacheHit` exists and is **never written** — always `false`.
- `LedgerEntryType` belongs to the unused ledger.

### 4.11 Redis

`common/redis.service.ts`, via `ioredis`, `lazyConnect: true`.

| Use | Key | TTL | Status |
|---|---|---|---|
| Scan result cache | `scan:<sha256(resume+jd+tier+fresherMode)>` → `{scanId}` | **30 days** | Implemented |
| Rate limiting | `ratelimit:<userKey>:<window>` | window seconds | **`checkRateLimit()` is defined and never called anywhere** |
| Queues / locks / idempotency | — | — | Not implemented |

- **Options are part of the key** (see §4.10).
- **Fails soft.** Every Redis operation is wrapped in try/catch. A cache miss or
  connection failure never blocks a scan; the rate limiter fails *open*.
- **Cache-hit attribution:** on a hit, an unowned scan is claimed by the
  requesting user, a scan the user already owns is returned as-is, and a scan
  owned by someone else is **copied onto a new row** for them. Every branch still
  skips the pipeline, so the cost saving stands.
- **No invalidation logic exists** — entries simply expire after 30 days.
- `dump.rdb` exists on disk but is gitignored and not committed.

### 4.12 Frontend architecture

**Entry:** `main.jsx` imports `design-system/index.css` (fonts → tokens → base →
component styles) and wraps `<App/>` in `<ToastProvider>`.

**Composition:** `App.jsx` owns routing, `RequireAuth`, and which shell each route
gets. `AppShell` renders sidebar + top bar (bottom nav below 768px); `PublicShell`
renders a minimal header for signed-out visitors.

```
User
 ↓ route (App.jsx)
Shell (AppShell | PublicShell)  ← ErrorBoundary per route
 ↓
Page / feature component
 ↓ useEffect
api/client.js  → fetch + Authorization + refresh-on-401
 ↓ /api/* (Vite proxy)
NestJS
```

**State:** `AuthContext` is the only session source · server state is hand-rolled
`useEffect` + `useState` per screen (**no React Query**, despite being specified
in the Phase 1 plan) · preferences in `localStorage` (`parse.session`,
`parse.prefs`, sidebar collapse).

**The single mapping seam:** `features/analysis/reportData.js` →
`mapScanToReport()`. Every backend field rename touches exactly this function.
**Panels never read `scan.details.*` directly.** Preserve this.

**Browser dependencies:** `localStorage` for session/preferences — onboarding
answers have nowhere else to live, since `User` has no experience or tier column.
URL hash carries the active report tab. The Vite dev proxy must be replaced in
production by a real reverse proxy, or the `BASE` constant in `api/client.js`
changed (it is hardcoded to `"/api"` with no env override).

**Client-side behaviour worth knowing:**
- **PDF text extraction runs in the browser** via pdf.js, so an unreadable scanned
  PDF is caught before any request is sent — and costs nothing.
- Processing is **honest**: the pipeline has no progress stream, so only the
  elapsed counter moves and the "done" rows are things genuinely known before the
  request went out. Faking progress on the one screen asking the user to wait and
  trust it would be self-defeating.

**Error and loading handling:** `ErrorBoundary` per route · skeletons that
preserve layout · `EmptyState` / `ErrorState` components · every error message
states what happened, what happened to the user's data, and what to do next.

**Responsive:** breakpoints 640 / 768 / 1024 / 1280. Sidebar → icon rail → bottom
nav. The report drops tabs entirely below 768 and stacks into accordions.

---

## 5. API reference

Base URL (dev): `http://localhost:3000` (or `PORT`). Frontend calls `/api/*`,
which Vite rewrites by stripping the prefix. **11 endpoints.**

| Method | Endpoint | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/auth/register` | Create account | No | Implemented |
| POST | `/auth/login` | Sign in | No | Implemented |
| POST | `/auth/refresh` | Rotate tokens | Refresh token in body | Implemented |
| GET | `/auth/google` | Start Google SSO | No | **Partial** — only registered if creds set |
| GET | `/auth/google/callback` | SSO callback | No | **Partial** — returns JSON, no redirect |
| POST | `/scan` | Run an analysis | **Optional** | Implemented |
| GET | `/scans` | Signed-in user's scans (`?take=25`) | **Required** | Implemented |
| GET | `/scan/:id` | One scan + versions + prep sets | **None** | Implemented — unguarded, shareable |
| POST | `/scan/:id/rewrite` | Rewrite → verify → re-score → prep | **None** | Implemented |
| GET | `/scan/:id/diff` | Original vs latest rewritten | **None** | Implemented |
| GET | `/scan/:id/interview-prep` | Latest prep set | **None** | **Partial** — 404s until a rewrite runs |

**Not implemented:** any rescan endpoint, logout, `/auth/me`, forgot-password,
health, credits, payments, WhatsApp webhook, analytics ingestion, resume CRUD,
file upload.

### Example — `POST /scan`

```jsonc
// request
{ "resumeText": "Aditya Sharma\n…", "jdText": "Backend Developer — …",
  "tier": "MNC", "fresherMode": false }

// response 201 (abridged, real values from a live run)
{
  "id": "cmsoua1xd0000zhgst9t4anyx",
  "status": "COMPLETE",
  "tier": "MNC",
  "score": {
    "generic": 43, "naukri": 48, "exactMatch": 30, "semanticMatch": 70,
    "gapReason": "Your resume headline is completely blank …",
    "categories": [
      { "key": "Keyword coverage", "earned": 9,  "max": 30, "source": "code",
        "reason": "3 of 10 JD keywords present, 5 critical missing" },
      { "key": "Experience fit",   "earned": 0,  "max": 20, "source": "llm", "reason": "…" }
    ]
  },
  "roadmap": [ { "rank": 1, "fix": "…", "gain": 15, "conf": "high", "evidence": "…" } ],
  "details": { "deterministic": {…}, "quality": {…}, "semantic": {…}, "tierCalibration": {…} }
}
```

### Frontend → backend contract

| Frontend call | Endpoint | Auth |
|---|---|---|
| `api.register` / `api.login` | `POST /auth/register` · `/auth/login` | — |
| *(internal)* `refreshSession()` | `POST /auth/refresh` | **Single in-flight promise** so concurrent 401s do not triple-rotate |
| `api.listScans` | `GET /scans` | **Required** |
| `api.createScan` | `POST /scan` | **Optional** — anonymous scans work |
| `api.getScan` | `GET /scan/:id` | **None** — shareable report links |
| `api.rewriteScan` | `POST /scan/:id/rewrite` | None |
| `api.getDiff` | `GET /scan/:id/diff` | None — **zero call sites** |
| `api.getInterviewPrep` | `GET /scan/:id/interview-prep` | None — **zero call sites** |

> ⚠️ **Access control on `GET /scan/:id` is the unguessable cuid alone.** Anyone
> holding an id can read that resume + JD (real name, phone, email). Conscious
> trade for share/deep-link — revisit before launch.
>
> `POST /scan/:id/rewrite` being equally unguarded is **not** a conscious trade —
> it is a write/spend endpoint (~9–12 LLM calls) with no ownership check, no rate
> limit and no credit check, reachable by anyone holding a share link.

---

## 6. Authentication

```
POST /auth/register → bcrypt(cost 12) → User row
      └→ issueTokens()
             ├── accessToken   JWT (15m), signed with JWT_SECRET
             └── refreshToken  raw string to client; SHA-256 hash stored (30d)
POST /auth/login → compare hash → issueTokens
                      ↓
Authenticated:  Authorization: Bearer <accessToken>
                      ↓ JwtStrategy.validate → { userId, email } on req.user
On 401: client posts refreshToken → new pair, old row revoked (rotation)
                      ↓
Refresh fails → session cleared → /login (destination preserved)
```

**Implemented:** bcrypt hashing · JWT access + **rotating** refresh tokens stored
**hashed** · `OptionalJwtGuard` (attaches a user if present, never rejects) and
`JwtAuthGuard` (required for `GET /scans`) · frontend `AuthContext`,
single-flight silent refresh-on-401, protected routes, intended-destination
redirect.

**Partial / missing:** Google SSO callback wiring (returns JSON on the backend
origin, so nothing lands in `localStorage`) · **logout** (`revokeAll()` exists but
nothing calls it; refresh tokens live 30 days unrevocable) · **forgot password**
(no endpoint) · tokens live in `localStorage`, not httpOnly cookies ·
`JWT_SECRET` falls back to the literal `"change-me"` in two places ·
`JWT_REFRESH_SECRET` is declared but **never read** (refresh tokens are random
bytes, not JWTs).

---

## 7. Design system ("Signal")

All values live in `frontend/src/design-system/` as tokens — **no hardcoded
values in components**. Live reference at `/design-system`. A legacy
`src/signal/` still exists and is used only by `SignIn`; it retires with that
screen.

### 7.1 Colour

```
PRIMARY   --accent #3A2BD9  (8.5:1 on white, AAA)  --accent-hover #2E21B0
          --accent-wash #EEECFC                    --accent-on #FFFFFF
SURFACES  --paper #F7F8F9   --surface #FFFFFF      --surface-2 #FBFCFD
          --rule #E2E6EA    --rule-soft #EDF0F2
TEXT      --ink #0E1116     --ink-mid #3D4650      --ink-mute #79838F
          --ink-disabled #AEB6BE
SEMANTIC  --good #12735A / #E9F4F1                 --warn #B07103 / #FCF4E6
          --critical #C4382A / #FBEDEB
```

The brief suggested `#4F46E5`; `#3A2BD9` is deeper, already shipping, scores
**8.5:1 on white** (AAA) versus ~6.4:1, and reads less like default framework
indigo.

**Rules:** colour encodes meaning, never decoration · **never colour alone**
(pair with an icon or text label — WCAG 1.4.1, and ~8% of male users are
red/green colour-blind) · `scoreColor()` thresholds `<55` critical, `<75` warn,
else good · **no dark mode in v1** (a second theme doubles the surface area
before the first is finished).

### 7.2 Typography

Self-hosted **IBM Plex** woff2 via Fontsource, `font-display: swap` — a previous
Google Fonts `@import` failed silently with no visible signal. Verified: **zero
external network requests.**

| Role | Face | Size / line | Weight | Tracking |
|---|---|---|---|---|
| Display | Sans | 40 / 1.1 | 600 | −0.03em |
| H1 | Sans | 28 / 1.2 | 600 | −0.02em |
| H2 | Sans | 21 / 1.3 | 600 | −0.02em |
| H3 | Sans | 16 / 1.4 | 600 | −0.005em |
| Body | Sans | 15 / 1.6 | 400 | 0 |
| Body small | Sans | 13.5 / 1.55 | 400 | 0 |
| Caption | Sans | 12.5 / 1.5 | 400 | 0 |
| Label | **Mono** | 10 / 1.4 | 500 | 0.12em, uppercase |
| Data | **Mono** | 12 / 1.5 | 400 | 0.02em |
| Score sm / md / XL | **Mono** | 18 / 30 / 56, line 1 | 600 | −0.02 / −0.03em |

**Mono is the instrument.** Every number, label, chip, badge and score uses Plex
Mono; prose uses Plex Sans. This is what makes the product read as an analysis
tool rather than a content generator. All numeric columns get
`font-variant-numeric: tabular-nums`.

### 7.3 Spacing, radius, shadow, motion

```
--s-1  4   --s-2  8   --s-3 12   --s-4 16   --s-5 24
--s-6 32   --s-7 48   --s-8 64   --s-9 96

--r-sm  6   chips, badges, inputs, buttons      --r-lg 12  cards, panels
--r-md  8   small cards                         --r-xl 16  modals, drawers

--shadow-sm  0 1px 2px  rgba(14,17,22,.05)   cards (rarely needed)
--shadow-md  0 4px 12px rgba(14,17,22,.08)   dropdowns, popovers
--shadow-lg  0 12px 32px rgba(14,17,22,.12)  modals only

--t-fast 120ms ease-out  hover, focus
--t-base 200ms ease-out  expand, tab change
--t-slow 400ms ease-out  score count-up, before/after
```

| Context | Value |
|---|---|
| Page padding — desktop / tablet / mobile | 32 / 24 / 16 |
| Card padding — default / compact | 16 / 12 |
| Section gap | 32 |
| Grid gutter | 24 desktop, 16 mobile |
| Form field gap | 14 |
| Inline chip gap | 6 |

Lay out with flex/grid `gap`, **never per-child margins**. Hierarchy comes from
**borders and background tone**, not floating shadows. All motion sits inside
`@media (prefers-reduced-motion: reduce)` guards.

### 7.4 Breakpoints

```
--bp-sm  640   phone → large phone
--bp-md  768   tablet
--bp-lg 1024   laptop — sidebar appears
--bp-xl 1280   desktop — full two-column analysis
```

| Range | Shell | Report |
|---|---|---|
| < 768 | Bottom nav, no sidebar | Single scroll, no tabs, sticky CTA |
| 768–1023 | Icon rail | Tabs, single column |
| 1024–1279 | Full sidebar, collapsible | Tabs, two columns |
| ≥ 1280 | Full sidebar | Two columns + persistent score header |

**App shell:** sidebar is 240px expanded / 64px icon rail collapsed, **auto-
collapses on `/report/*`** where content width is worth more than persistent
labels, user-toggleable with the choice persisted, and becomes bottom navigation
below 768px. The bottom nav is *rendered* only below 768, not CSS-hidden, so it
is not duplicated in the accessibility tree.

### 7.5 Score category labels (relabel only — backend unchanged)

| Backend `key` | Weight | UI label |
|---|---|---|
| `Keyword coverage` | 30 | Skills & keywords |
| `Experience fit` | 20 | Experience |
| `Bullet quality` | 20 | Impact & achievements |
| `Structure` | 15 | Sections & projects |
| `Contact & format` | 15 | Formatting & contact |

Points earned is `earned`; points lost is `max − earned`. Both come from the same
object, so the "earned vs lost" split needs no new data.

### 7.6 Iconography

**Lucide React**, 1.5px stroke, sizes 14/16/20/24 only, `currentColor`.
Tree-shakeable, no runtime cost. Icons support scanning; they never replace a
label. **No emoji in the UI.**

Semantic set: `Check` good · `AlertTriangle` warn · `XCircle` critical · `Lock`
gated · `Info` explanation · `ArrowRight` progression.

### 7.7 Components

`Button`, `IconButton`, `Field`/`Input`/`Textarea`/`Select`/`Checkbox`/`Radio`/
`ChoiceGroup`, `Card`/`CardHeader`/`Divider`, `ScoreRing`/`ProgressBar`,
`Sidebar`/`TopBar`/`BottomNav`, `Page`/`Section`/`Grid`/`Split`,
`Chip`/`KeywordChip`, `Badge`/`SourceBadge`/`PriorityBadge`/`VerificationBadge`/
`ConfidenceMark`/`LockedBlock`, `Tabs`/`TabPanel`, `Skeleton`×4,
`Alert`/`EmptyState`/`ErrorState`, `ToastProvider`/`useToast`, `Modal`, `ICON`.

`Page` carries the measure — `narrow` 560 / `default` 940 / `wide` 1200.

**Three components encode product rules rather than styling:** `SourceBadge`
(LOCAL/MODEL), `ConfidenceMark` (bars **and** the word, so it survives a
screenshot and a screen reader), and `VerificationBadge` — which keeps *"verify
this"* and *"not published"* as separate states, the distinction the optimize
flow depends on.

**Still to build:** `Table`, `ComparisonView`, `BulletCard`, `QuestionCard`,
`Breadcrumb`, `LoopIndicator`, `Tooltip`, `Drawer`, `Dropdown`, `MetricCard`.

### 7.8 Hard UI rules — do not break these

1. **Never print a point value next to a missing keyword** unless it is the
   derived `maxPoints / totalJdSkills` figure badged `LOCAL`. Point estimates
   otherwise appear only on roadmap items, always prefixed `≈` with `conf`
   rendered beside them.
2. **Provenance is always visible.** `LOCAL` / `MODEL` renders on every score row.
   This is the product's core claim; it does not get dropped for density.
3. **Two distinct rewrite warnings, never conflated** (see [§9](#9-screens--routes)).
4. **Never expose model names, agent names, call counts or token spend.**
   `UsageLog` is for the operator.
5. **Every error states what happened to the user's data and to their money.**
6. **Never colour alone** — every state pairs colour with an icon or text label.
7. **No emoji in the UI.**
8. **Marketing copy never promises a score gain, an interview, or a percentage
   improvement.** The honest and stronger claim is diagnostic: *"See exactly which
   requirements you miss, and what it costs you."*

### 7.9 Headline scores

Three rings: **Match** (`score.generic`), **Portal score** (`score.naukri`, with
gap = `generic − naukri` and `gapReason`), **Resume quality**
(`quality.sections[]` + `bulletQualityScore`).

There is deliberately **no "interview readiness" ring.** Nothing in the pipeline
measures it, and fabricating the most prominent number on the most important
screen would undercut the product's core claim. It is a *state* on the prep
screen. If the number is wanted later, compute it as roadmap coverage — that needs
per-question progress tracking, which no table records today.

### 7.10 Free vs paid

Free keeps the **whole diagnosis**: all three scores, the full category breakdown,
all strengths and problems, the complete missing-requirements list, and the top 3
roadmap items (`FREE_ROADMAP_ITEMS = 3`).

Paid buys the **treatment**: rewrite + verification, re-score, and interview prep.

The locked block shows the *shape* of what is behind it — "11 more fixes, worth
about +14" with the first two titles legible — **never a blurred rectangle**.
**Upgrade is never the primary CTA on a result screen**; the primary CTA is "Fix
my resume", and the paywall is the consequence of pressing it.

> ⚠️ This gating is **client-side only** today. `GET /scan/:id` ships the complete
> roadmap, so it is trivially bypassable. Truncation must move server-side before
> anyone is charged.

---

## 8. User flows

### C.1 Primary — new user to prepared candidate

```
Landing → Sign up → Onboarding → Dashboard
   → Analyze (resume + JD + tier + experience)
   → Processing
   → Report: Overview
   → Fixes → Optimize
   → Review each change (accept / reject / edit)
   → Verify flagged claims
   → Re-score → Before/After
   → Interview Prep
   → Download → Apply
```

### C.2 Returning user

`Dashboard → "Next step" band → Report → continue where they left off`

### C.3 WhatsApp arrival

`WhatsApp result → deep link → /report/:scanId (mobile) → sign up to keep it`

### C.4 Verification failure — the trust flow

```
Optimize → rewrite runs → VerifyAgent fails after 2 retries
   → "We did not publish this rewrite"
   → show the claims it tried to add
   → original resume intact, credit not consumed
   → Try again  |  Fix manually
```

### C.5 Free user hitting the wall

`Report (full diagnosis, top 3 fixes) → "Fix my resume" → paywall → upgrade → returns to the blocked action, unlocked`

---

## 9. Screens & routes

### 9.1 Implemented routes (verified from `src/App.jsx`)

| Route | Component | Shell | Auth |
|---|---|---|---|
| `/` | `pages/Landing` | Public | No |
| `/login` | `screens/SignIn` | Public (no nav) | No |
| `/app` | `screens/Dashboard` | App | **Yes** |
| `/app/onboarding` | `pages/Onboarding` | App | **Yes** |
| `/app/analyze` | `features/analysis/AnalyzePage` | App | **Yes** |
| `/report/:scanId` | `features/analysis/ReportPage` | App if signed in, else Public | **No** |
| `/design-system` | `pages/DesignSystemPreview` | None | No |
| `*` | → `/` | — | — |

**Specified but not built:** `/signup` (folded into `/login`),
`/forgot-password`, `/how-it-works`, `/pricing`, `/app/resumes`, `/app/prep`,
`/app/settings`, `/report/:id/optimize`, `/report/:id/result`,
`/report/:id/prep`.

Nav is **five items** — Dashboard · Analyze · My Resumes · Interview Prep ·
Settings — with the last three rendered **disabled with a reason**, not linking
nowhere.

### 9.2 Screen specifications

#### E.1 Landing `/`
**Purpose** — get a resume and a JD into the box.
**Layout** — hero with the actual first input, not a picture of one. Then:
product preview (annotated real report) · how it works · ATS intelligence ·
**Naukri gap** *(the section a competitor cannot copy — give it the illustration
budget)* · verified rewriting · interview prep · before/after · trust & privacy ·
pricing · FAQ · final CTA · footer.
**CTA** — primary `Analyse my resume`; secondary `See how it works`.
**States** — Error: inline on the hero input. Success: navigates to processing.

#### E.2 Auth `/login` `/signup` `/forgot-password`
**Purpose** — minimum friction; never the star of the screen.
**Layout** — single 380px card. Contextual heading: arriving from a finished scan
reads *"Save your analysis"*.
**CTA** — `Create account` / `Sign in`; Google secondary.
**States** — Loading: button spinner, form disabled. Error: inline above the
button, mapped to human copy (`friendly()` in `SignIn.jsx`). Success: redirect to
intended destination.

#### E.3 Onboarding `/app/onboarding`
**Purpose** — capture the two answers that change scoring.
**Layout** — one screen, three questions: experience (required), target tier
(required), target role (optional). The two required answers map to
`ScanOptions.fresherMode` and `tier`.
**CTA** — `Continue`; `Skip` always available.
Answers live in `localStorage` — `User` has no experience or tier column.

#### E.4 Dashboard `/app`
**Purpose** — answer *"what do I do next?"* before any statistic.
**Layout** — (1) greeting, (2) **next-step band** — the most recent scan with
unaddressed fixes and a direct CTA; never empty (falls back to *"Analyse a new
job"*), (3) metric row, (4) recent analyses, (5) usage/credits.

**Metrics — resolved.** Of the brief's four, only one has a data source:

| Brief asks | v1 shows | Why |
|---|---|---|
| Resume Health | **Best match** — `max(score.generic)` | Real |
| Interview Readiness | **Prep sets ready** + question count | No readiness measure exists |
| Applications | **Analyses run** | No `Application` model |
| Interviews | **Optimized** — verified rewrites | Product never observes an interview |

**States** — Loading: 3 skeleton rows. Empty: *"Analyse your first job"* + CTA.
Error: inline card, retry.

#### E.5 Analyze `/app/analyze`
**Purpose** — four inputs, one screen, no wizard.
**Layout** — two columns ≥900px (resume | JD), tier and experience below as chip
groups. Returning users see them collapsed as *"MNC · Fresher — change"*; never
hidden, since they are the India differentiators.
**CTA** — `Analyse my resume`, with cost and duration beside it.
**States** — Error: unreadable PDF → reveal a paste textarea inline; JD < 200
chars → "That looks like a job title, not a description."

#### E.6 Processing `/app/analyze/:id/running`
**Purpose** — hold attention honestly for ~30 seconds.
**Layout** — staged checklist. The first three lines are genuinely known
(client-side parse, JD parse, local deterministic checks are free and instant).
**Do not show** model names, agent names, call counts, or token spend.
**Depends on** **BE-3**; until then ship the 3-stage version.

#### E.7 Report `/report/:scanId` — the most important screen
**Purpose** — score, evidence, and one obvious next action.
**Layout** — six panels, one fetch, tab in the URL hash. **Default tab is
Overview**, not Score.

```
Overview   verdict · 3 rings · what's working · what's hurting · fix first · CTA
Score      5 categories, earned/lost/reason/provenance
Keywords   exact vs semantic · requirement ledger · found · missing · overused
Quality    section scores · weak bullets
Fixes      full roadmap, gated after 3
Prep       locked — "Unlocks after you optimize"
```

**Panel → field mapping:**

| Panel | Reads |
|---|---|
| Overview | `score`, `roadmap[0..2]`, `details.*` |
| Score | `score.categories[]` — `earned`, `max`, `reason`, `source` |
| Keywords | `deterministic.{exactMatchPct,foundKeywords,missingKeywords,overusedPhrases}`, `semantic.{semanticMatchPct,matches}` |
| Quality | `quality.sections[]`, `quality.weakBullets[]` |
| Fixes | `roadmap[]` — `rank`, `fix`, `gain`, `conf`, `evidence` |
| Prep | `InterviewPrepSet.{technical,hr}` — locked until a rewrite exists |

**CTA** — `Fix my resume`.
**Responsive** — ≥1024 two columns, score header persists on scroll. <768 no tabs:
score → problems → fixes → sticky CTA, details as accordions.
**States** — Loading: skeleton preserving ring positions. Error: 404 → "That
analysis link has expired."

#### E.8 Optimize `/report/:scanId/optimize`
**Purpose** — never let AI change a resume silently.
**Layout** — one change at a time. Original | Improved side by side ≥1024, stacked
below. Beneath: *why this changed*. Actions: `Accept` · `Keep original` · `Edit`.
Progress counter in the header.

**Two distinct warnings, never conflated:**

| | Trigger | Treatment |
|---|---|---|
| **Verify this claim** | The rewrite introduces a number or claim absent from the original — *shown even when verification passed*, because "traceable" is weaker than "true" | Amber block, three responses: accurate / edit / remove |
| **We did not publish this** | `status: "verification_failed"` | Red, full screen, original intact, credit unspent |

**States** — Loading: rewriting → checking every claim → re-scoring. Error: the
failure screen above, which is a **trust asset, not an embarrassment** — most
competitors would have silently shipped the fabricated claim.

#### E.9 Result `/report/:scanId/result`
**Purpose** — make the value obvious.
**Layout** — Before → After with the delta as the largest element; then
per-category movement.
**CTA** — `Prepare for the interview`; secondary `Download resume`.
**Caveat** — until **BE-2** lands, the caption must read *"re-scored on all
suggested changes"*, and rejecting a change must visibly invalidate the
after-score rather than silently keeping it.

#### E.10 Interview prep `/report/:scanId/prep`
**Purpose** — prepare for *this* interview, from *these* gaps.
**Layout** — weak areas first, then questions grouped by weak area, with
Technical/HR as a secondary filter. Every question shows its `why`, never
collapsed — that field is what separates this from a question bank.
**Note** — the backend returns `technical[]` and `hr[]` only. Grouping by weak
area needs no new agent output; the brief's six categories do not exist.
**States** — Locked: *"Unlocks after you optimize"*, not a generic padlock — prep
is gated by the **data model**, not by payment.

#### E.11 Resume library `/app/resumes`
**Purpose** — see every resume and its best result.
**Blocked by** the schema: `ResumeVersion` belongs to `Scan`, and there is no
`Resume` entity. Until **BE-5**, ship **My Scans** grouped by loop stage
(In progress · Optimized · Not started) — which is also the truer model of a job
hunt. **Actions** — Open · Re-analyse · Rename · Duplicate · Delete.

#### E.12 Version history `/app/resumes/:id`
**Layout** — linear: Original → Current, with the change count between them and a
`Compare` action. Rejected rewrites appear as a note, not a version — they were
never saved. No branching tree in v1.

#### E.13 Settings `/app/settings`
Account · plan and credits · **privacy**: what is stored, delete a resume, delete
the account. State plainly what happens to the data; make no unsupported security
claims.

#### E.14 Global states

**Loading** — skeletons that preserve final layout; never a full-page spinner
except the first authenticated paint. Buttons keep their size and swap the label
for a spinner.

**Empty** — every one names the object that would fill it and offers the action
that creates it. No shrugs.

**Error** — every message answers three questions: what happened · what happened
to my data and my money · what do I do now.

| Condition | Message |
|---|---|
| Scanned-image PDF | "We could not find any text in that PDF — it looks like a scan. Paste your resume text instead." |
| Unsupported file | "We can read PDF, DOCX and TXT." |
| JD too short | "That looks like a job title, not a description." |
| Pipeline failed | "We could not finish the analysis. Your resume is safe and your credit has not been used." |
| Verification failed | Dedicated screen — E.8 |
| Rate limited | "You have used all N analyses this month. They reset on \<date\>." |
| Payment failed | "That payment did not go through — your bank may have declined it. Nothing was charged." |
| Session expired | Silent refresh; on failure, return to the same page after login |
| Unauthorized | "This analysis belongs to another account." |
| Offline | "You are offline. Your inputs are saved on this device." |

---

## 10. Feature-by-feature status

| Feature | Frontend | Backend | Database | AI | API | Tested | Production ready |
|---|---|---|---|---|---|---|---|
| Resume + JD analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Near |
| Scoring with provenance | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Near |
| Keyword / semantic matching | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Near |
| Resume quality + weak bullets | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Near |
| Fix roadmap | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Near |
| AI rewrite + verification | Partial | ✅ | ✅ | ✅ | ✅ | ❌ | No |
| Re-score after rewrite | Partial | ✅ | ✅ | ✅ | ✅ | ❌ | No |
| Interview prep | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | No |
| Auth (email) | ✅ | ✅ | ✅ | — | ✅ | ❌ | Near |
| Auth (Google) | Partial | Partial | ✅ | — | Partial | ❌ | No |
| Dashboard | ✅ | ✅ | ✅ | — | ✅ | ❌ | Near |
| Scan history | ✅ | ✅ | ✅ | — | ✅ | ❌ | Near |
| Resume library / versions | ❌ | Partial | Partial | — | Partial | ❌ | No |
| Credits | ❌ | ❌ | ✅ | — | ❌ | ❌ | No |
| Razorpay | ❌ | ❌ | ✅ | — | ❌ | ❌ | No |
| WhatsApp | ❌ | ❌ | — | — | ❌ | ❌ | No |
| Resume builder | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Out of scope |
| Salary prediction | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not in scope |

### Partially completed work — what is missing

| Feature | Current state | Missing |
|---|---|---|
| Google SSO | Strategy + routes exist, conditionally registered | Credentials; callback must redirect to the frontend instead of returning JSON |
| Interview prep | Agent, storage, endpoint | UI; decoupling from the rewrite (BE-6) |
| Resume optimization | Rewrite, verification, re-score, both outcomes handled | Per-change accept/reject/edit; decision persistence; re-score on the accepted subset; before/after screen |
| Resume versions | `ResumeVersion` written on scan and rewrite; `/diff` works | No UI; no `Resume` parent entity, so lineage is per-scan |
| Redis | Caching | Rate limiter never called; no invalidation |
| Credits | Schema only | Every read, write, check, and refund path |
| Analytics | Event taxonomy + `track()` | Provider, ingestion, call sites beyond auth/scan |
| Cost telemetry | Rows written | Real `RATE_CARD` values — currently records 0 |
| Recruiter comment | Generated every rewrite | Never persisted; not returned by `GET /scan/:id` |
| Referral message | Agent implemented | Not wired to any endpoint |
| Legacy `signal/` | Retained for `SignIn` | Migration of `SignIn` onto the design system |

---

## 11. Open decisions, defects & blockers

### 11.1 Launch blockers

1. **Zero tests** — there is **no `jest.config.*` and no `ts-jest` transform**, so
   `npm test` cannot compile TypeScript even if test files existed. `ts-jest` and
   `@types/jest` are already installed — this is a config-only fix. `VerifyAgent`
   (the safety claim) has no coverage.
2. **BE-2 — no rescan endpoint**, so the "after" score describes a resume the user
   never accepted change-by-change. `runFromStructured()` already does the right
   thing internally and needs a route.
3. **No deployment path** — no Dockerfile, compose, CI, staging, error monitoring,
   or backups.
4. **No real-user validation** — 20–30 users is the project's actual kill switch.
   The pipeline working is necessary, not sufficient.
5. **`POST /scan` runs the ~30s pipeline synchronously inside the HTTP request.**
   Most PaaS proxies (Render, Railway, Fly, Heroku, Cloudflare) time out at
   30–60s → this is a deployment blocker and promotes **BE-3** (`Scan.stage`)
   from cosmetic to required. Likely needs `202 + poll`. Measure p95 first — the
   data already exists:
   ```sql
   SELECT "scanId", sum("latencyMs") FROM "UsageLog" GROUP BY "scanId";
   ```

### 11.2 Security

| Issue | Location |
|---|---|
| `POST /scan/:id/rewrite` **unauthenticated**, ~12 LLM calls per call | `scan.controller.ts` |
| `checkRateLimit()` fully implemented, **zero call sites** | `common/redis.service.ts` |
| Bare `app.enableCors()` — all origins | `main.ts` |
| `JWT_SECRET` falls back to `"change-me"`, no boot validation | `jwt.strategy.ts`, `auth.module.ts` |
| Free-tier gating client-side only — full roadmap in the payload | `reportData.js` |
| No logout — `revokeAll()` has zero callers; refresh tokens live 30 days | `auth.service.ts` |
| Tokens in `localStorage`, not httpOnly cookies | `api/client.js` |
| Unguarded `GET /scan/:id` returns full resume + JD PII behind a cuid only | `scan.controller.ts` |
| No Helmet / CSP / HSTS; no server-side file limits | — |

### 11.3 Known defects

- Every `UsageLog.costUsd` is `0` — `RATE_CARD` has `0.0` for all three live
  Gemini models.
- **`MIN_JD` (200 chars) declared but not enforced** — `canSubmit` uses the
  20-char resume minimum for the JD too, so a user can submit a job *title* and
  get a confident, meaningless score.
- **Dead 429 branch** — the analyze page shows quota copy for a limit the backend
  does not implement.
- **No refetch after rewrite** — `hasPrep` stays false and the Prep tab stays
  disabled until a manual reload.
- **Rewrite is not idempotent** — a double-click burns ~12 LLM calls twice.
- **`.doc`/`.docx` advertised in the file picker, then rejected.**
- `ScanStatus.PENDING` never written (dead state).
- **No favicon** — a 404 on every page load.

### 11.4 Open product decisions

- **Government tier** — currently structural guidance only, selectable in the UI
  with no signal it is narrower than the other three. Flagged as needing an
  explicit product decision; **deferred, never resolved.**
- **Interview Readiness score** — wanted by the brief; nothing measures it. Could
  become "gap coverage" once per-question progress is tracked (P2).
- **Applications / Interviews counters** — no `Application` model; the product
  never observes an interview.
- Nav item count (5 in code vs conflicting older specs).

### 11.5 Escalation candidate

Route `VerifyAgent` off flash-class to `gemini-3.1-pro-preview` (one line). The
product's core safety guarantee has never been measured on the current model.

### 11.6 Technical debt

| Debt | Why it matters |
|---|---|
| No tests at all | Every change is unverified; the safety claim is untested |
| Prompts inline in agents | No versioning or A/B testing; prompt edits invisible in review |
| Server state hand-rolled | `useEffect` + `useState` per fetch; no caching, retry, or dedupe |
| Legacy `signal/` beside `design-system/` | Two token sources; only `SignIn` uses the old one |
| `screens/` vs `features/` vs `pages/` | Three folders with overlapping roles mid-migration |
| Duplicate Prisma/Redis pools | Each module re-provides them |
| Pipeline runs inside the request | No queue, no progress, no resumability |
| Scan JSON columns unqueryable | Blocks analytics over score history later |
| No ESLint config | Despite `eslint-disable-next-line` comments in four files |
| No `engines` field | Node version drift between machines |
| Frontend bundle ~745 kB (~225 kB gzipped) | Vite warns; no code-splitting or lazy loading |

### 11.7 Environment quirks

Outbound network on the development machine has been flaky —
`fonts.googleapis.com` and `registry.npmjs.org` were unreachable at points, and
one live scan failed with `fetch failed` from the Gemini SDK (the backend
correctly marked that scan `FAILED`). This is why fonts are self-hosted and why
the page must make **zero external requests**.

---

## 12. Running it locally

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | **No `engines` field pinned.** Verified on v24.14.0; Vite 5 requires ≥18; `@types/node` pinned to ^20 |
| Package manager | **npm** — both projects have `package-lock.json` |
| PostgreSQL | With the `vector` extension available |
| Redis | Optional — the app degrades gracefully without it |
| Docker | Optional; only to host Postgres/Redis locally. **No Dockerfile or compose file exists** |

### Setup

```bash
# 1. install
cd backend && npm install
cd ../frontend && npm install

# 2. infrastructure — no compose file exists; these are the exact commands
docker run -d --name parse-postgres \
  -e POSTGRES_PASSWORD=<your-password> -e POSTGRES_DB=parse_dev \
  -p 5434:5432 pgvector/pgvector:pg17
docker run -d --name parse-redis -p 6380:6379 redis:7-alpine
docker exec parse-postgres psql -U postgres -d parse_dev \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 3. environment
cd backend && cp .env.example .env
# fill DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, and ≥1 LLM key

# 4. database
npx prisma migrate dev --name init   # or: npm run prisma:migrate
npm run prisma:generate

# 5. run
npm run start:dev                    # :3000
cd ../frontend && npm run dev        # :5173, proxies /api → :3000
```

**Port clash:**

```bash
PORT=3001 npm run start:dev
VITE_API_ORIGIN=http://localhost:3001 npx vite --port 5188 --strictPort
```

**Build:** `npm run build` in each (`nest build` / `vite build`);
`npm run preview` serves the production build.

### First run

1. Open the frontend → **Analyse my resume** → create an account
2. Onboarding: experience + target tier (both skippable)
3. Analyse: paste a resume and a **full** job description
4. Wait ~30 s → the report opens on **Overview**
5. Visit `/design-system` to see the component set

### Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection (needs pgvector) | **Yes** |
| `REDIS_URL` | Redis connection | Recommended — degrades gracefully |
| `GEMINI_API_KEY` | Gemini provider — **the only one provisioned**; also **all embeddings** | **Yes** |
| `ANTHROPIC_API_KEY` | Anthropic provider | No — implemented but unrouted |
| `OPENAI_API_KEY` | OpenAI provider | No — implemented but unrouted |
| `JWT_SECRET` | Access-token signing | **Yes** — ⚠️ falls back to `"change-me"` |
| `JWT_REFRESH_SECRET` | Declared but **never read** | No |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | Google SSO | No — strategy skipped if unset |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | Payments | No — **no code reads them** |
| `WHATSAPP_TOKEN` / `_VERIFY_TOKEN` / `_PHONE_NUMBER_ID` | WhatsApp | No — **no code reads them** |
| `PORT` | Backend port | No — defaults to 3000 |
| `VITE_API_ORIGIN` | Frontend proxy target (run-time, not in `.env.example`) | No — defaults to `http://localhost:3000` |

### Gotchas

- **Prisma 7 removed `url` from `schema.prisma`.** The CLI URL lives in
  `prisma.config.ts`; the runtime uses `@prisma/adapter-pg` in
  `common/prisma.service.ts`. **Do not "fix" this by adding a `url` back.**
- **TypeScript is deliberately held at 5.x** — `ts-node`/`ts-jest` compatibility
  with TS 7's rewritten compiler internals is unverified.
- **`tsconfig.json` must not set `incremental: true`** while `nest-cli.json` sets
  `deleteOutDir: true` — `tsc` skips re-emitting files it believes are current
  even right after `dist/` is wiped, producing a silent empty build (exit 0, no
  output).
- **`api/client.js` hardcodes `BASE = "/api"`** with no env override, so
  production needs a reverse proxy at that path.
- **No seed script exists.**
- **Gemini free tier limits** (probed live): 15 RPM flash-lite, **5 RPM** for both
  `gemini-3.6-flash` and `gemini-3.5-flash`. A single failing rewrite makes 6
  sequential calls on a 5-RPM model — it can exhaust quota alone; two concurrent
  users will 429.

### Reading order for a new developer

| # | File | Why |
|---|---|---|
| 1 | This file | Motive and scope |
| 2 | `backend/prisma/schema.prisma` | The data model is the real contract |
| 3 | `backend/src/agents/types.ts` | Every shape passed between agents |
| 4 | `backend/src/orchestrator/scan-pipeline.ts` | How a scan actually runs |
| 5 | `backend/src/agents/score-aggregator.ts` | Where the number comes from |
| 6 | `backend/src/orchestrator/rewrite-pipeline.ts` | The fail-closed loop — the core claim |
| 7 | `backend/src/llm/llm-provider.ts` | Validation and retry at the model boundary |
| 8 | `backend/src/scan/scan.service.ts` | Caching, ownership, persistence |
| 9 | `frontend/src/App.jsx` | Routes and shells |
| 10 | `frontend/src/features/analysis/reportData.js` | The API→UI seam |
| 11 | `frontend/src/features/analysis/ReportPage.jsx` | The most important screen |
| 12 | `frontend/src/design-system/tokens.css` | Every visual value |

---

## 13. Testing plan

> **Current state: there are zero test files.** `npm test` runs jest against
> nothing — and there is no jest config, so it could not compile TypeScript even
> if files existed. **This is the single largest risk in the project.**

### H.1 Backend unit

- `ScoreAggregator` — the exported golden sets, actually run. Pure arithmetic, so
  assertions are exact.
- `DeterministicCheckAgent` — keyword match, `exactMatchPct`, metric detection,
  timeline gaps, contact validation.
- `RedisService.cacheKey` — **different options must produce different keys.** A
  collision here bills a PSU scan as a Startup scan.
- `resolveModel()` — env-override precedence and the throw on unknown agents.
- `completeStructured()` — schema failure → one repair → throw.

These are fast, zero-cost and CI-safe.

### H.2 AI evaluation — the safety-critical suite

`VerifyAgent` is the product's central promise and has **zero coverage**. Build a
fixture set of rewrites containing known fabrications and assert the pipeline
**fails closed** on every one:

| Fixture | Must be caught |
|---|---|
| Invented metric ("reduced latency 40%") | ✅ |
| Invented team size ("led 5 engineers") | ✅ |
| Invented employer | ✅ |
| Invented skill absent from the original | ✅ |
| Altered employment dates | ✅ |
| Invented seniority ("Senior" from "Junior") | ✅ |
| Unsupported achievement | ✅ |
| **Legitimate rephrasing** | ❌ **must NOT be flagged** (false-positive guard) |

Assert the terminal contract: on failure the returned `resume` is **identical to
the original** and `flaggedClaims` is non-empty. Track precision and recall over
time — **a verifier that flags everything is as broken as one that flags
nothing**, and you cannot see that without both halves of the suite.

### H.3 Backend integration

Scan pipeline end to end against fixtures · cache-hit path consumes no model call
· cache-hit ownership branches (claim / return / copy) · rewrite fail-closed path
· auth register/login/refresh/rotation · credit spend and refund-on-failure.

### H.4 Frontend

Component tests for the design system (variants, disabled, loading, focus) · form
validation · `mapScanToReport()` against real payloads including missing/null
fields · token helpers · single-flight refresh-on-401 · responsive snapshots at
all four breakpoints · accessibility assertions (axe) on every page.

### H.5 E2E (Playwright)

```
signup → onboarding → upload → analyze → report
      → optimize → accept → re-score → prep
```

Plus: verification-failure path · free-tier paywall · expired session ·
unreadable PDF · WhatsApp deep link into `/report/:scanId`.

### H.6 Non-functional

Scan p95 latency · cost per scan from `UsageLog` (blocked on BE-10) · rate-limit
enforcement · file size and type validation · no horizontal overflow at
1440/1024/834/390 · zero external network requests.

---

## 14. Roadmap

Priorities: **P0** core · **P1** launch · **P2** post-launch · **P3** later.

### 14.1 Phases

| Phase | Scope | Priority | Status |
|---|---|---|---|
| **0 — Audit** | Repository audit, design system spec, screen specs | — | **Done** |
| **1 — Design system** | Self-hosted fonts · full token set · Lucide · ~20 components · folder restructure · React Query | **P0** | **Done** (React Query not adopted) |
| **2 — App shell** | Sidebar (auto-collapse on report) · top bar · bottom nav · responsive grid · error boundary · toasts | **P0** | **Done** |
| **3 — Core flow** | Landing · auth polish + 401 refresh · onboarding · dashboard on real data · analyze · processing | **P0** | **Done** |
| **4 — Analysis experience** | Report at full desktop width · Overview panel · score with earned/lost · real per-keyword impact · quality · weak bullets · roadmap · fix bugs 1–3 | **P0** | **Done** |
| **5 — Optimization** | Diff view · accept/reject/edit · verify-this · verification-failed screen · before/after | **P0** | **NEXT** |
| **6 — Interview prep** | Weak areas · grouped questions · question detail | **P1** | Planned |
| **7 — Resume management** | My Scans → resume library · versions · compare · rename/duplicate/delete | **P1** | Planned (needs BE-5) |
| **8 — Auth & ownership** | Guard on `/scan` · scans belong to users · protected routes · server-side scan list | **P0** | **Done early** (BE-1, shipped in Phase 3) |
| **9 — Monetisation** | Credit ledger writes · free limits · pricing · Razorpay · transaction history · failed payment | **P1** | Planned |
| **10 — Testing** | Unit · integration · **AI hallucination evaluation** · E2E | **P0** | **Not started — largest risk** |
| **11 — Performance & security** | Indexing · rate limits · file validation · OWASP · monitoring · backups | **P1** | Planned |
| **12 — Real-user validation** | 20–30 users, funnel + qualitative | **P0** | Planned — **the kill switch** |
| **13 — Launch** | MVP | **P1** | Planned |
| **14 — Post-launch** | WhatsApp · mock interviews · analytics · portfolio analysis | **P2/P3** | Planned |

**Sequencing rules**

- Phase 8 is **P0 and should run alongside Phase 3**, not after it — without it
  the dashboard cannot list scans. *(Honoured.)*
- Phase 10 is P0 and **continuous, not a gate before launch**.
- Phase 9 must not start before Phase 5 is reliable. Charging for a rewrite flow
  that is still changing is how refunds happen.
- Phase 12 is the **kill switch** for everything after it.

### 14.2 Backend work items the UX depends on

**No change to the AI orchestration is required by any of these.**

| # | Change | Unblocks | Size | Status |
|---|---|---|---|---|
| **BE-1** | Optional JWT guard on `ScanController`; persist `userId`; add `GET /scans` (paginated, user-scoped) | Dashboard, library, ownership | S | **Done** |
| **BE-2** | `POST /scan/:id/rescan` accepting a composed resume — wraps the existing `ScanPipeline.runFromStructured()` | Honest before/after on accepted changes | S | **Open — highest priority** |
| **BE-3** | `Scan.stage` written between waves; expose via `GET /scan/:id` or SSE | Staged processing screen | S | Open |
| **BE-4** | Persist accepted/rejected decisions per change on `ResumeVersion` | Resuming an interrupted review | S | Open |
| **BE-5** | `Resume` entity; `ResumeVersion` hangs off it; `Scan` references it | Resume library, cross-job lineage | M | Open |
| **BE-6** | Decouple `InterviewPrepSet` from rewrite — allow generation after a scan | Prep without paying for a rewrite | S | Open |
| **BE-7** | Credit ledger writes, balance endpoint, spend on scan/rewrite, refund on failure | Free/paid gating, honest refund copy | M | Open |
| **BE-8** | Razorpay order + webhook + `Transaction` | Payments | M | Open |
| **BE-9** | Persist + surface `recruiterComments` in `GET /scan/:id` | Already generated and discarded — free win | XS | Open |
| **BE-10** | Fill `RATE_CARD` with verified Gemini pricing | Cost telemetry currently computes **zero** | XS | Open |
| **BE-11** | Analytics event endpoint or client SDK | Funnel measurement | S | Open |

> **BE-2 is the one that matters.** Without it the product prints a headline
> number describing a resume the user did not accept — on the screen whose only
> job is proving the product worked.

### 14.3 Recommended near-term order

1. **Config + hardening bundle** (~1 week, all small): jest config, CI workflow,
   guard `/scan/:id/rewrite`, call `checkRateLimit()`, lock CORS, validate
   `JWT_SECRET` at boot, BE-9, BE-10, enforce `MIN_JD`, rewrite idempotency.
2. **VerifyAgent adversarial eval** — ~2 days, and it gates the next step. If the
   catch rate is poor, Phase 5's accept/reject UI makes the product *more*
   dangerous, not less, because that UI is a trust amplifier.
3. **BE-2 + Phase 5** (scoped: cut inline editing, verify-this, and BE-4).
4. **Deployment + Sentry + analytics sink** — start in parallel with 3.
5. **Phase 12 — 20–30 real users.** Pre-commit the kill/pivot criterion *before*
   collecting data.
6. Monetisation, then whichever of prep/library the data points at.

### 14.4 Future — explicitly not MVP

**P2 — after real users**
Interview readiness as measured gap coverage · practice answers · application
tracking · WhatsApp · multi-provider routing restored + a real rate card ·
referral flow (`ReferralMessageAgent` already exists) · score simulation ("what if
I add Docker?" — computable with no model call) · React Query adoption ·
code-splitting.

**P3 — later**
Voice/video mock interviews · LinkedIn and portfolio analysis · campus and
placement-cell dashboards (bulk scanning, cohort analytics) · portal scoring
beyond Naukri · recruiter-side view · resume A/B testing · regional languages.

> **Prioritise by observed demand, not by what is technically possible.**

---

## 15. Launch checklist

**Technical** — all P0 phases done · E2E green · AI evaluation suite passing ·
error monitoring · structured logging · DB indexed and backed up · rate limits ·
CORS locked to the real origin · secrets out of source · staging environment.

**Product** — every screen has loading/empty/error states · mobile verified on
real devices · WCAG AA (contrast, keyboard, focus, screen-reader score
announcements, no colour-only meaning) · copy reviewed for promises the product
cannot keep.

**Security & privacy** — resume retention policy stated · delete resume · delete
account · JWT expiry and rotation verified · authorization checked (one user
cannot read another's scan) · file upload limits · OWASP top-10 pass · no
unsupported security claims in marketing.

**Monetisation** — credit ledger correct under concurrency · refund on pipeline
failure · Razorpay webhook idempotent · **GST treatment decided** ·
failed-payment recovery · pricing page matches enforcement.

**Analytics** — the full funnel instrumented. The 23 events already named in
`services/analytics.js`:

```
signup · signin · signout · onboarding_completed · onboarding_skipped
resume_uploaded · jd_submitted · scan_started · scan_completed · scan_failed
report_viewed · optimization_started · rewrite_accepted · rewrite_rejected
rescan_started · score_improved · interview_prep_opened
interview_question_viewed · upgrade_clicked · checkout_started
payment_completed · verification_failed_shown · claim_verification_responded
```

The last two were added beyond the original list on purpose: the first says how
often the trust path actually fires, the second whether anyone engages with a
flagged claim rather than clicking past it. **~8 of these are currently never
emitted**, and `track()` is dev-console-only — there is no transport (BE-11).

---

## 16. Build history

### 16.1 Corrections made to the original plan while building

- **`NaukriScoreAgent` circular dependency.** The planned wave design ran it in
  parallel with Semantic/Quality, *before* `ScoreAggregator` computes the generic
  score — so it could not take that score as an input to explain the gap. Fixed by
  having it return only `naukriScore` + a qualitative `gapReason`; the numeric gap
  is computed downstream as `generic − naukri`.
- **Prisma 5 → 7.** The current release removed the datasource `url` from
  `schema.prisma` entirely. Migrated for real: CLI URL in `prisma.config.ts`,
  runtime via `@prisma/adapter-pg`. Verified against the live CLI —
  `prisma generate`, `prisma validate`, `tsc --noEmit`, `nest build` all clean.
- **TypeScript held at 5.x**, deliberately not bumped to 7.x alongside it.
- **Per-agent provider split collapsed to Gemini-only** — only `GEMINI_API_KEY` is
  provisioned. This is a table edit, not an architecture change.
- **Migrated off the legacy `@google/generative-ai` SDK** to `@google/genai`.
- **"3 batched LLM calls" was never achievable.** The real count is **7**.
- **The fail-open verification loop was corrected to fail closed** (FR-8a) — the
  source plan shipped the unverified rewrite once retries were exhausted.

### 16.2 Two bugs found only by hitting the live API

- **`embedContent` silently treats a flat `contents: string[]` as multiple parts
  of one content**, returning a single averaged embedding instead of one per term.
  Fixed by wrapping each term as its own `{ parts: [{ text }] }`.
- **`gemini-2.5-pro` was unusable** on this key, and `gemini-2.5-flash` 404s as
  deprecated for new accounts. Frontier tier now runs on `gemini-3.5-flash`.

### 16.3 One build bug, not Gemini-specific

`tsconfig.json`'s `incremental: true` combined with `nest-cli.json`'s
`deleteOutDir: true` caused a recurring broken build — `tsc` would skip
re-emitting files it believed were up to date, even right after `dist/` was wiped,
because the `.tsbuildinfo` cache does not know the output was deleted. Removed
`incremental`; it was breaking builds silently (exit 0, empty `dist/`).

### 16.4 The cache/ownership bug

Adding scan ownership (BE-1) broke the cache path in a way that only appeared when
tested:

> A signed-in user whose resume+JD had already been scanned by anyone got back
> that **other row**. Their analysis never appeared in their dashboard.

FR-6 says identical inputs must not re-run the pipeline; it does not say the
result belongs to whoever ran it first. `attributeCachedScan()` resolves it:

```
unowned + signed-in  → claim it        (this is the signup-after-scan path)
already theirs       → return as-is
owned by another     → copy results onto a new row for them
```

Every branch still skips the pipeline, so the cost saving stands.

### 16.5 Every bug found and fixed

| # | Bug | Location | Found by |
|---|---|---|---|
| 1 | Naukri gap panel hardcoded critical red — a *higher* portal score rendered as a problem | `ATSScanReport.jsx:160` | Running the app |
| 2 | Tier rendered `Mnc` / `Psu` | `ATSScanReport.jsx:42` | Running the app |
| 3 | Fabricated per-keyword points (`PRIORITY_GAIN`) | `ATSScanReport.jsx:16` | Reading the code |
| 4 | Fonts fetched from a CDN, failing silently | `signal/tokens.js:30` | Console check |
| 5 | Skip link unreachable under React StrictMode | `AppShell.jsx` | Keyboard test |
| 6 | Collapse toggle dead on report routes | `Sidebar.jsx` | Shell test |
| 7 | Wordmark clipped to "PARS" on mobile | `Navigation.css` | Screenshot |
| 8 | Duplicate wordmark on `/app/analyze` | `UploadScreen.jsx` | Screenshot |
| 9 | **Cache hit returned another user's scan row** | `scan.service.ts` | API test |
| 10 | Paste box unmounted while typing into it | `AnalyzePage.jsx` | E2E test |
| 11 | "first job" / "new job" copy mismatch | `Dashboard.jsx` | E2E test |
| 12 | Keyword terms rendered lowercase | `reportData.js` | Screenshot |

**Nine of twelve were found by running the thing, not by reading it.**

`ATSScanReport.jsx` (624 lines of inline-styled prototype) was replaced in Phase 4
and no longer exists.

### 16.6 Design decisions that departed from the brief

| Brief asked for | Delivered | Why |
|---|---|---|
| Interview Readiness as a headline score | **Portal score** (`score.naukri` + `gapReason`) | Nothing in the pipeline measures readiness. The portal gap is the India differentiator the brief describes and then never places. |
| Missing keywords show "+5 points" | Real value `maxPoints / totalJdSkills` | The old number came from a constant whose own comment said "presentational only". |
| Dashboard: Applications, Interviews | Best match, Analyses, Optimised, Prep sets | No `Application` model; the product never observes an interview. |
| Six score categories | The backend's five, relabelled | UI-only relabel, no backend change. |
| "My Resumes" with version lineage | "My Scans" | `ResumeVersion` belongs to `Scan`; there is no `Resume` entity. |
| Primary `#4F46E5` | Kept `#3A2BD9` | Already shipping; 8.5:1 on white vs ~6.4:1; less like default framework indigo. |
| Sidebar navigation | Sidebar that auto-collapses to a rail on `/report/*` | Honours the brief while giving the analysis screen its width back. |

### 16.7 Verified by running, not by inspection

- Full scan: **HTTP 201 in ~30 s**, coherent output (43 generic / 48 Naukri,
  7 missing keywords, 6 weak bullets, 4 roadmap items)
- Signup → onboarding → dashboard → analyse → processing → report → listed
- Auth wall → sign in → return to intended page
- BE-1: 401 without token, cached scan attributed, anonymous scan still works
- All 12 routed agents + embeddings pass live against the Gemini API
- Fonts loaded (`document.fonts.check()` true for both families); **zero external
  network requests**
- Tabs arrow-key nav · locked tab not selectable · modal focus trap + Escape ·
  toast polite vs assertive routing
- No console errors; no horizontal overflow at 1440 / 1024 / 834 / 390
- Production builds clean on both sides

---

## 17. Open questions for the team

1. **Is billing enabled on the Gemini key, or can it be?** Current free-tier RPM
   makes even one failing rewrite quota-risky and blocks concurrency (roughly two
   simultaneous users).
2. **Escalate `VerifyAgent` off flash-class?** One-line routing change to
   `gemini-3.1-pro-preview`; the safety claim is currently unmeasured.
3. **Deployment target?** Decides whether `POST /scan` must become `202 + poll`
   and whether BE-3 is required or optional.
4. **Order: tests → Phase 5, or Phase 5 → tests?** The Optimize UI's value is "we
   verified every change" — if catch rate is poor, that UI is *more* dangerous, so
   the VerifyAgent eval arguably comes first.
5. **Is unguarded `GET /scan/:id` returning full PII an accepted risk?**
6. **Is WhatsApp still the distribution channel?** Business verification has a
   multi-week lead time — start the paperwork now if yes, regardless of build
   order.
7. **Government tier — decide or defer again?**
8. **Review/commit/revert the uncommitted `llm-provider.ts` retry change?**

---

## 18. Glossary

| Term | Meaning here |
|---|---|
| **ATS** | Applicant Tracking System — parses and ranks resumes before a human sees them |
| **JD** | Job description — the posting a resume is analysed against |
| **Scan** | One analysis of one resume against one JD with one set of options; a DB row |
| **Match score** | `score.generic` — the headline 0–100 from `ScoreAggregator` |
| **Portal score** | `score.naukri` — how a Naukri-style parser would read the resume |
| **Portal gap** | `generic − naukri`. Positive = weaker on the portal |
| **Exact match** | Literal keyword overlap, `found / uniqueJdSkills` — deterministic |
| **Semantic match** | Meaning-level match from embeddings + model judgement |
| **Agent** | One pipeline unit: single responsibility, a prompt, a Zod output schema. Two are pure code |
| **Orchestrator / pipeline** | `ScanPipeline` / `RewritePipeline` — the only callers of agents |
| **Wave** | A group of agents run in parallel; waves run in sequence |
| **LOCAL / MODEL** | UI badges for `ScoreCategory.source` — arithmetic vs model judgement |
| **Verification** | `VerifyAgent` tracing every claim in a rewrite back to the original |
| **Fail-closed** | On exhausted retries, return the original rather than an unverified rewrite |
| **Flagged claim** | A statement the verifier could not trace to the original |
| **Resume version** | `kind: "original"` or `"rewritten"`, with `verified` and `flagged` |
| **Re-score** | Running the scan pipeline again over a rewritten resume |
| **Roadmap** | Ranked fixes with `gain` (estimated points) and `conf` |
| **Tier** | Employer type — Startup / MNC / PSU / Government; changes scoring |
| **Fresher mode** | Scores projects and certifications instead of penalising missing years |
| **Credit** | Unit of paid usage. Schema exists; **nothing grants or consumes credits** |
| **Golden test** | An input/expected-output fixture exported by an agent. **No runner executes them** |

---

## Appendix A — Provenance & corrected claims

This file replaces six overlapping documents that had drifted out of sync after
active development. Corrections folded in (older doc → reality):

- "Not a git repository / initialise git" → **it IS a git repo** (1 commit,
  `e8e3fc8 Initial commit`).
- "8 REST endpoints" → **11** (6 scan + 5 auth).
- "`dump.rdb` committed at root" → present on disk but **gitignored, never
  committed**.
- "Live pipeline run not yet exercised" → **superseded**; verified HTTP 201 in
  ~30s with coherent output.
- "`gemini-2.5-pro` has a hard `limit: 0`" → now a **404** ("no longer available
  to new users"); replacement `gemini-3.1-pro-preview` is available on the key.
- Pre-Phase-4 UI audit ("the desktop experience does not exist", 480px cap, zero
  media queries, `ATSScanReport.jsx` bugs) → **stale**; that file was deleted and
  all four bugs fixed.
- "15 agents export golden tests" → 15 *files* do (one is `_template.ts`); **only
  4 have real fixtures, 10 are placeholders, none are run** — and they use four
  incompatible shapes.
- Nav 5 vs 4 across specs → **code implements 5**.
- `UsageLog.cacheHit` "records cache-hit status" → field exists, **never
  written**.
- "TypeScript 5.9" vs `package.json` declaring `^5.5.4` → both true; it **resolves
  to 5.9.3**.

**Two independent phase systems** existed in the old docs (product Phases 0–3 and
implementation Phases 0–14) and were easy to conflate. This file keeps the
implementation phases (§14.1) as the operative plan and folds the product-phase
status into §2.

**The `PARSE_Master_Plan.md`** referenced by section number throughout the old
sources (§8.3, §13.2, FR-8a, …) **was never in this repository**. Those
`§`-references are unresolvable and have been dropped in favour of describing the
code directly. A handful of source comments still carry them — treat those as
historical noise.

**Undocumented findings added here**, recorded in none of the originals: the
unguarded `POST /scan/:id/rewrite` spend path · the client-side-only paywall · the
unenforced `MIN_JD` · rewrite non-idempotency · the measured Gemini free-tier RPM
limits · and the 30-second synchronous request that is likely to break on first
deploy.
