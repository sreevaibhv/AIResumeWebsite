# PARSE// — Complete Project Architecture, Implementation & Current State

**Single technical source of truth for the current state of the repository.**

Every statement below was verified against the code. Where something does not
exist, it says so. Nothing is described as built because it was planned.

Status labels used throughout:

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Exists, wired, and exercised end to end |
| **PARTIAL** | Exists but incomplete, unwired, or unenforced |
| **NOT IMPLEMENTED** | No code in the repository |
| **PLANNED** | Specified in a design document, no code |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current project status](#2-current-project-status)
3. [Technology stack](#3-technology-stack)
4. [High-level architecture](#4-high-level-architecture)
5. [Repository structure](#5-repository-structure)
6. [Frontend architecture](#6-frontend-architecture)
7. [Frontend routes](#7-frontend-routes)
8. [Backend architecture](#8-backend-architecture)
9. [Backend modules](#9-backend-modules)
10. [API reference](#10-api-reference)
11. [Authentication](#11-authentication)
12. [Database](#12-database)
13. [Redis](#13-redis)
14. [AI architecture](#14-ai-architecture)
15. [AI agents](#15-ai-agents)
16. [Orchestration](#16-orchestration)
17. [Prompts](#17-prompts)
18. [Scan pipeline & scoring engine](#18-scan-pipeline--scoring-engine)
19. [Optimization & AI safety](#19-optimization--ai-safety)
20. [Feature-by-feature status](#20-feature-by-feature-status)
21. [Environment variables](#21-environment-variables)
22. [Running the project](#22-running-the-project)
23. [Testing](#23-testing)
24. [Deployment, CI/CD, observability](#24-deployment-cicd-observability)
25. [Security & performance](#25-security--performance)
26. [Failure handling](#26-failure-handling)
27. [Data flow](#27-data-flow)
28. [Completed work](#28-completed-work)
29. [Partially completed work](#29-partially-completed-work)
30. [Remaining tasks & roadmap](#30-remaining-tasks--roadmap)
31. [Blockers, known bugs, technical debt](#31-blockers-known-bugs-technical-debt)
32. [Architectural decisions](#32-architectural-decisions)
33. [New developer onboarding](#33-new-developer-onboarding)
34. [Glossary](#34-glossary)
35. [Final status](#35-final-status)

---

## 1. Executive summary

**PARSE//** analyses a candidate's existing resume against one specific job
description, explains where and why it falls short, produces a ranked list of
fixes, rewrites the resume with verification against the original, re-scores
the result, and generates interview questions from the identified gaps.

It is **not** a resume builder and not a job board. It analyses a resume the
candidate already has, against a posting they name.

**Who it is for:** early-career job seekers in the Indian market. Two market
facts are first-class inputs rather than settings — Indian hiring is
portal-first (Naukri's parser behaves differently from a generic ATS), and
employer tiers (Startup / MNC / PSU / Government) screen for different things.

**Product objective:** make the invisible filter visible. The failure a
candidate never learns about is being screened out before a human reads the
resume.

**Current stage:** working prototype with a complete analysis experience.
The scan pipeline, scoring, rewriting with verification, and the full
report UI run end to end against a live database and a live LLM. Monetisation,
testing, and deployment do not exist.

**Architecture style:** two-tier — a React SPA talking REST to a NestJS
monolith, with a wave-based multi-agent LLM orchestrator inside it.

---

## 2. Current project status

| Area | Status | Details |
|---|---|---|
| Frontend | **IMPLEMENTED** | Landing, auth, onboarding, dashboard, analyse, processing, 6-panel report; full design system; responsive |
| Backend | **IMPLEMENTED** | NestJS, 8 REST endpoints, two pipelines, 14 agents |
| Design system | **IMPLEMENTED** | Tokens + ~20 components, self-hosted fonts, `/design-system` reference |
| Authentication | **PARTIAL** | Email/password + JWT + refresh rotation work. Google SSO wired but inert without credentials. No forgot-password |
| ATS scan | **IMPLEMENTED** | Verified live: HTTP 201 in ~30 s |
| AI analysis | **IMPLEMENTED** | 3 waves, ~7 LLM calls, Zod-validated structured output |
| Scoring engine | **IMPLEMENTED** | Deterministic weighted arithmetic, no LLM in the final number |
| Resume optimization | **PARTIAL** | Rewrite + verification + re-score work; per-change accept/reject UI not built |
| Interview prep | **PARTIAL** | Agent + storage + endpoint exist; no UI; only generated during a rewrite |
| Database | **IMPLEMENTED** | Postgres + pgvector, 10 models, migrated |
| Redis | **PARTIAL** | Caching works; rate limiter defined but never called |
| Dashboard | **IMPLEMENTED** | Server-backed via `GET /scans` |
| Credits | **NOT IMPLEMENTED** | Tables exist; nothing reads or writes them |
| Razorpay / payments | **NOT IMPLEMENTED** | Env vars only, no code |
| WhatsApp | **NOT IMPLEMENTED** | Env vars only, no receiver |
| Resume builder | **NOT IMPLEMENTED** | Explicitly out of scope |
| Salary prediction | **NOT IMPLEMENTED** | Not in scope; no code, no schema |
| Testing | **NOT IMPLEMENTED** | Zero test files |
| Deployment / CI-CD | **NOT IMPLEMENTED** | No Dockerfile, compose, or workflows in the repo |
| Observability | **PARTIAL** | Per-LLM-call `UsageLog` written; cost computes 0 (see §24) |

---

## 3. Technology stack

### Frontend — `frontend/package.json`

| Concern | Choice | Notes |
|---|---|---|
| Framework | React 18.3 | — |
| Language | JavaScript (JSX) | No TypeScript on the frontend |
| Build | Vite 5.4 | Dev proxy `/api` → backend |
| Routing | React Router 6.26 | — |
| Styling | Plain CSS + custom properties | No Tailwind, no CSS-in-JS library |
| Icons | `lucide-react` | — |
| Fonts | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | Self-hosted, bundled by Vite |
| PDF | `pdfjs-dist` 6.2 | Text extraction in the browser |
| State | React Context + `useState` | **No** Redux/Zustand; **no** React Query — server state is hand-rolled in `useEffect` |
| Forms | None | Native form elements + local state |
| Charts | None | Rings/bars are hand-built SVG and CSS |

### Backend — `backend/package.json`

| Concern | Choice |
|---|---|
| Framework | NestJS |
| Language | TypeScript 5.9 (deliberately not 7.x — see §32) |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Validation | `class-validator` + `class-transformer` (DTOs); **Zod** for LLM output |
| Auth | Passport — `passport-jwt`, `passport-google-oauth20`; `@nestjs/jwt` |
| API | REST |
| LLM SDK | `@google/genai` (Gemini) |
| Cache | `ioredis` |
| Queue | **NOT IMPLEMENTED** — no BullMQ or equivalent |
| Logging | NestJS default logger + `console` |

### Database
PostgreSQL with the **pgvector** extension. Schema: `backend/prisma/schema.prisma`.
Migrations via Prisma Migrate. Connection URL lives in `backend/prisma.config.ts`
for the CLI and is supplied to `PrismaClient` through a driver adapter at
runtime — Prisma 7 removed `url` from the schema file.

### AI
Gemini only at present. `backend/src/llm/model-routing.ts` defines a
cheap/mid/frontier tiering; Anthropic and OpenAI provider code exists and is
implemented but **unrouted**, because only `GEMINI_API_KEY` is provisioned.

### Infrastructure
**NOT FOUND IN CURRENT REPOSITORY** — there is no Dockerfile, no
`docker-compose.yml`, no `.github/`, no CI configuration, no deployment
manifests, and no `scripts/` directory. Local Postgres and Redis were started
with ad-hoc `docker run` commands (see §22); those commands are not committed.

---

## 4. High-level architecture

```
                    ┌──────────────────────────────┐
                    │   Browser — React 18 + Vite  │
                    │  design-system · features    │
                    └──────────────┬───────────────┘
                                   │ REST, /api/* via Vite dev proxy
                                   ▼
                    ┌──────────────────────────────┐
                    │        NestJS monolith       │
                    │  AuthModule  ·  ScanModule   │
                    └───────┬──────────────┬───────┘
                            │              │
              ┌─────────────┘              └──────────────┐
              ▼                                           ▼
     ┌──────────────────┐                        ┌──────────────────┐
     │  ScanPipeline    │                        │ RewritePipeline  │
     │  3 waves, ~7     │                        │ rewrite → verify │
     │  LLM calls       │                        │ → re-score       │
     └────────┬─────────┘                        └────────┬─────────┘
              └──────────────────┬─────────────────────────┘
                                 ▼
                    ┌──────────────────────────────┐
                    │   completeStructured()       │
                    │   Zod-validated LLM calls    │
                    │   + one corrective retry     │
                    └──────────────┬───────────────┘
                                   ▼
                 ┌─────────────┬──────────┬─────────────┐
                 │  Anthropic  │  OpenAI  │   Gemini    │  ← only Gemini keyed
                 └─────────────┴──────────┴─────────────┘

   ┌───────────────────────┐   ┌──────────────┐   ┌────────────────────┐
   │ PostgreSQL + pgvector │   │    Redis     │   │      UsageLog      │
   │ users, scans, versions│   │ result cache │   │ per-call tokens,   │
   │ prep sets, ledger     │   │ (rate limit  │   │ latency, cost      │
   │ SkillEmbedding vectors│   │  unused)     │   │                    │
   └───────────────────────┘   └──────────────┘   └────────────────────┘
```

**No queue, no worker process, no background jobs.** `POST /scan` runs the
entire pipeline synchronously inside the request.

---

## 5. Repository structure

```
AIResumeWebsite/
├── backend/                        NestJS API + agent orchestrator
│   ├── prisma/schema.prisma        10 models — source of truth for data
│   ├── prisma.config.ts            CLI connection URL (Prisma 7)
│   └── src/
│       ├── main.ts                 bootstrap, CORS, ValidationPipe, usage logging
│       ├── app.module.ts           imports ConfigModule, ScanModule, AuthModule
│       ├── agents/                 16 files — 12 LLM agents, 2 pure-code, types, template
│       ├── orchestrator/           scan-pipeline.ts, rewrite-pipeline.ts
│       ├── llm/                    llm-provider.ts, model-routing.ts, types.ts, providers
│       ├── auth/                   controller, service, strategies, guards, DTOs
│       ├── scan/                   controller, service, module, DTOs
│       ├── vector/                 pgvector.store.ts, embed.ts
│       └── common/                 prisma.service.ts, redis.service.ts, usage-logger.ts
│
├── frontend/                       React SPA
│   └── src/
│       ├── main.jsx                entry — loads design system, mounts ToastProvider
│       ├── App.jsx                 routes, auth gate, shell selection
│       ├── design-system/          tokens + ~20 components (see §6)
│       ├── layouts/                AppShell, PublicShell
│       ├── features/analysis/      AnalyzePage, ProcessingState, ReportPage, reportData, panels/
│       ├── pages/                  Landing, Onboarding, DesignSystemPreview
│       ├── screens/                Dashboard, SignIn  (legacy folder, being retired)
│       ├── contexts/               AuthContext
│       ├── services/               analytics.js
│       ├── hooks/                  useMediaQuery
│       ├── components/             ErrorBoundary
│       ├── api/client.js           fetch wrapper, session, refresh-on-401
│       └── signal/                 legacy tokens + ui — used only by SignIn
│
├── README.md                       pre-session build status (partly stale)
├── PROJECT.md                      motive, scope, architecture overview
├── DESIGN-AND-ROADMAP.md           audit, design system spec, screen specs, phases
├── BUILD-LOG.md                    what was built, in order, with bugs found
└── PROJECT_DOCUMENTATION.md        this file
```

`dump.rdb` at the root is a stray Redis dump, not used by the application.

---

## 6. Frontend architecture

**Entry:** `main.jsx` imports `design-system/index.css` (fonts → tokens → base
→ component styles) and wraps `<App/>` in `<ToastProvider>`.

**Composition:** `App.jsx` owns routing, `RequireAuth`, and which shell each
route gets. `AppShell` renders sidebar + top bar (bottom nav below 768px);
`PublicShell` renders a minimal header for signed-out visitors.

### Flow

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

### Design system — `src/design-system/`

- `tokens.css` — colour, 12-role type scale, spacing 4→96, radius, shadow,
  motion, z-index, focus; contextual spacing shifts at breakpoints
- `base.css` — reset, `:focus-visible`, type utilities, `prefers-reduced-motion`
- `tokens.js` — JS mirror: `scoreColor`, `scoreTone`, `scoreLabel`, breakpoints
- `index.js` — barrel; components are imported from here, never from files
- Components: `Button`, `IconButton`, `Field`/`Input`/`Textarea`/`Select`/
  `Checkbox`/`Radio`/`ChoiceGroup`, `Card`/`CardHeader`/`Divider`,
  `ScoreRing`/`ProgressBar`, `Sidebar`/`TopBar`/`BottomNav`,
  `Page`/`Section`/`Grid`/`Split`, `Chip`/`KeywordChip`,
  `Badge`/`SourceBadge`/`PriorityBadge`/`VerificationBadge`/`ConfidenceMark`/
  `LockedBlock`, `Tabs`/`TabPanel`, `Skeleton`×4, `Alert`/`EmptyState`/
  `ErrorState`, `ToastProvider`/`useToast`, `Modal`, `ICON`

Live reference at `/design-system`.

### State
- **Auth:** `AuthContext` — the only source for session
- **Server state:** hand-rolled `useEffect` + `useState` per screen.
  **No React Query / SWR** despite being recommended in `DESIGN-AND-ROADMAP.md`
- **Preferences:** `localStorage` — sidebar collapse, onboarding answers

### Error and loading handling
`ErrorBoundary` per route; skeletons that preserve layout; `EmptyState` and
`ErrorState` components; every error message states what happened, what
happened to the user's data, and what to do next.

### Responsive
Breakpoints 640 / 768 / 1024 / 1280. Sidebar → icon rail → bottom nav.
The report drops tabs entirely below 768 and stacks into accordions.

---

## 7. Frontend routes

Verified from `src/App.jsx`.

| Route | Component | Shell | Auth | Status |
|---|---|---|---|---|
| `/` | `pages/Landing` | Public | No | **IMPLEMENTED** |
| `/login` | `screens/SignIn` | Public (no nav) | No | **IMPLEMENTED** — sign-in and sign-up in one screen |
| `/app` | `screens/Dashboard` | App | Yes | **IMPLEMENTED** |
| `/app/onboarding` | `pages/Onboarding` | App | Yes | **IMPLEMENTED** |
| `/app/analyze` | `features/analysis/AnalyzePage` | App | Yes | **IMPLEMENTED** — includes inline processing state |
| `/report/:scanId` | `features/analysis/ReportPage` | App if signed in, else Public | No | **IMPLEMENTED** — 6 panels |
| `/design-system` | `pages/DesignSystemPreview` | None | No | Dev reference |
| `*` | Redirect to `/` | — | — | — |

**Routes named in design docs but NOT IMPLEMENTED:** `/signup` (folded into
`/login`), `/forgot-password`, `/how-it-works`, `/pricing`, `/app/resumes`,
`/app/prep`, `/app/settings`, `/report/:id/optimize`, `/report/:id/result`,
`/report/:id/prep`. The last three sidebar entries render disabled with a
"Soon" marker rather than linking anywhere.

---

## 8. Backend architecture

**Bootstrap** — `src/main.ts`: creates the Nest app, `app.enableCors()`,
a global `ValidationPipe({ whitelist: true, transform: true })`, wires
per-call LLM usage logging, then listens on `process.env.PORT ?? 3000`.

**Modules** — `AppModule` imports `ConfigModule.forRoot({ isGlobal: true })`,
`ScanModule`, `AuthModule`. That is the entire module graph.

### Request flow

```
HTTP request
 ↓
Controller (ScanController | AuthController)
 ↓
Guard        OptionalJwtGuard (attaches user, never rejects)
             JwtAuthGuard     (rejects without a valid token)
 ↓
ValidationPipe → DTO (class-validator)
 ↓
Service (ScanService | AuthService)
 ↓
├── RedisService      cache lookup / write
├── PrismaService     persistence
└── Pipeline → agents → completeStructured() → Gemini
 ↓
JSON response
```

**Present:** controllers, services, modules, guards, DTOs, a global pipe.
**NOT IMPLEMENTED:** custom middleware, interceptors, exception filters,
role-based authorization, and a queue layer. Errors propagate to Nest's
default exception handler.

---

## 9. Backend modules

| Module | Purpose | Main files | Endpoints | Depends on | Status |
|---|---|---|---|---|---|
| `AppModule` | Root; global config | `app.module.ts` | — | Config, Scan, Auth | **IMPLEMENTED** |
| `AuthModule` | Registration, login, refresh rotation, Google SSO | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`, `google.strategy.ts`, `optional-jwt.guard.ts` | 5 | Prisma, JWT, Passport | **PARTIAL** — Google inert without credentials |
| `ScanModule` | Scan lifecycle, listing, rewrite, diff, prep retrieval | `scan.controller.ts`, `scan.service.ts` | 6 | Prisma, Redis, both pipelines, Passport | **IMPLEMENTED** |
| *Users* | — | — | — | — | **NOT IMPLEMENTED** — no separate module; users are handled inside Auth |
| *Credits* | — | — | — | — | **NOT IMPLEMENTED** |
| *Payments* | — | — | — | — | **NOT IMPLEMENTED** |
| *Interview* | — | — | — | — | **NOT IMPLEMENTED** as a module; one endpoint lives in `ScanModule` |
| *Dashboard* | — | — | — | — | **NOT IMPLEMENTED** as a module; the dashboard is built from `GET /scans` |

Shared providers (not Nest modules): `PrismaService`, `RedisService`,
`usage-logger.ts`, `PgVectorStore`.

---

## 10. API reference

Base URL in development: `http://localhost:3000` (or `PORT`). The frontend
calls `/api/*`, which Vite rewrites by stripping the prefix.

| Method | Endpoint | Purpose | Auth | Request | Response | Status |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | Create account | No | `{email, password(min 8), name}` | `{accessToken, refreshToken}` | **IMPLEMENTED** |
| POST | `/auth/login` | Sign in | No | `{email, password}` | `{accessToken, refreshToken}` | **IMPLEMENTED** |
| POST | `/auth/refresh` | Rotate tokens | Refresh token in body | `{refreshToken}` | `{accessToken, refreshToken}` | **IMPLEMENTED** |
| GET | `/auth/google` | Start Google SSO | No | — | Redirect | **PARTIAL** — route only registered when Google credentials are set |
| GET | `/auth/google/callback` | SSO callback | No | — | Tokens as JSON | **PARTIAL** — returns JSON instead of redirecting to the frontend |
| POST | `/scan` | Run an analysis | **Optional** | `{resumeText, jdText, tier?, fresherMode?}` | Full `Scan` row | **IMPLEMENTED** |
| GET | `/scans` | The signed-in user's scans | **Required** | `?take=25` | Array of projections | **IMPLEMENTED** |
| GET | `/scan/:id` | One scan with versions and prep sets | **None** | — | `Scan` + relations | **IMPLEMENTED** — unguarded so report links are shareable |
| POST | `/scan/:id/rewrite` | Rewrite, verify, re-score, generate prep | **None** | — | Verified result **or** `{status:"verification_failed", flaggedClaims}` | **IMPLEMENTED** |
| GET | `/scan/:id/diff` | Original vs latest rewritten version | **None** | — | `{original, rewritten}` | **IMPLEMENTED** |
| GET | `/scan/:id/interview-prep` | Latest prep set | **None** | — | `InterviewPrepSet` | **PARTIAL** — 404s until a rewrite has run |

**Not implemented:** any rescan endpoint, credits, payments, WhatsApp webhook,
analytics ingestion, resume CRUD, password reset.

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

### Access-control note

`GET /scan/:id` is deliberately unguarded so a report link works for someone
with no account. **The unguessable cuid is the entire access control.** Anyone
holding an id can read that resume and job description. This is a conscious
trade for the share/deep-link model and should be revisited before launch.

---

## 11. Authentication

### Flow (implemented)

```
POST /auth/register  →  bcrypt hash  →  User row
        │
        └→ issueTokens(userId, email)
               ├── accessToken   JWT, signed with JWT_SECRET
               └── refreshToken  raw string returned to client;
                                 SHA-hash stored in RefreshToken
POST /auth/login     →  compare hash  →  issueTokens
                                 ↓
Authenticated request:  Authorization: Bearer <accessToken>
                                 ↓
                        JwtStrategy.validate → { userId, email } on req.user
                                 ↓
On 401: client posts refreshToken → new pair issued, old row revoked (rotation)
                                 ↓
Refresh fails → session cleared → redirect to /login (destination preserved)
```

### Implemented
- Password hashing (bcrypt), never stored in plaintext
- JWT access tokens + rotating refresh tokens; refresh tokens stored **hashed**
- `OptionalJwtGuard` — attaches a user if present, never rejects
- `JwtAuthGuard` — required auth for `GET /scans`
- Frontend: `AuthContext`, silent refresh-on-401 sharing one in-flight promise,
  protected routes, intended-destination redirect

### Partial / not implemented
- **Google SSO** — strategy exists; `AuthModule` only registers it when
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The callback returns
  JSON rather than redirecting to the frontend (marked "wiring TBD" in code)
- **Logout** — client-side only; refresh tokens are not revoked on sign-out
  (`revokeAll()` exists in `AuthService` but no endpoint calls it)
- **Forgot password** — **NOT IMPLEMENTED**, no endpoint
- **Session storage** — tokens live in `localStorage`, not httpOnly cookies

---

## 12. Database

**PostgreSQL + pgvector.** Schema: `backend/prisma/schema.prisma`. Ten models.

```
User
 ├── RefreshToken      (hashed token, revokedAt, expiresAt)
 ├── CreditLedger      append-only; NO WRITES ANYWHERE
 ├── Transaction ──→ PricingVariant     NO WRITES ANYWHERE
 └── Scan   (userId nullable — anonymous scans are supported)
       ├── ResumeVersion     kind: "original" | "rewritten"
       │                     verified, flagged, diff
       └── InterviewPrepSet  technical[], hr[]

SkillEmbedding   standalone — normalizedTerm (unique) → vector(1536)
UsageLog         standalone — per-LLM-call telemetry, scanId optional
```

### Notable design points
- `Scan` stores **all pipeline output as JSON columns** (`resumeParsed`,
  `jdParsed`, `score`, `roadmap`, `naukri`, `details`) rather than normalised
  tables — the shapes are model-defined and change with prompts
- `Scan.cacheKey` = `sha256(resume + jd + tier + fresherMode)`
- `CreditLedger` is append-only with a running `balance` column, never a
  mutable integer — correct design, **entirely unused**
- `SkillEmbedding.normalizedTerm` is unique so embeddings are shared across
  users; skill terms repeat heavily

### Indexes
`User.email`, `RefreshToken.userId`, `Scan.cacheKey`, `Scan.userId`,
`ResumeVersion.scanId`, `InterviewPrepSet.scanId`, `SkillEmbedding.normalizedTerm`,
`CreditLedger.userId`, `Transaction.userId`, `UsageLog.agentName`,
`UsageLog.scanId`.

### Migrations
Prisma Migrate. `_prisma_migrations` exists in the live database and all 10
tables are present.

---

## 13. Redis

`backend/src/common/redis.service.ts`, via `ioredis`, `lazyConnect: true`.

| Use | Key | TTL | Status |
|---|---|---|---|
| Scan result cache | `scan:<sha256(resume+jd+tier+fresherMode)>` → `{scanId}` | **30 days** | **IMPLEMENTED** |
| Rate limiting | `ratelimit:<userKey>:<window>` | window seconds | **PARTIAL — `checkRateLimit()` is defined and never called anywhere** |
| Queues / locks / idempotency | — | — | **NOT IMPLEMENTED** |

### Behaviour
- **Options are part of the key.** A resume scored as PSU is not the same scan
  as the same resume scored for a Startup, and must not return a cached result.
- **Fails soft.** Every Redis operation is wrapped in try/catch. A cache miss
  or connection failure never blocks a scan; the rate limiter fails *open*.
- **Cache-hit attribution** (added this session): on a hit, an unowned scan is
  claimed by the requesting user, a scan the user already owns is returned
  as-is, and a scan owned by someone else is copied onto a new row for them.
  Every branch still skips the pipeline.

**No invalidation logic exists** — entries simply expire after 30 days.

---

## 14. AI architecture

### Provider layer — `src/llm/`

`completeStructured(prompt, zodSchema, agentName, opts)` is the single call
path for every agent:

1. Resolve model via `resolveModel(agentName)` — env override →
   explicit override → `MODEL_ROUTING` table
2. Call the provider
3. Strip code fences, `JSON.parse`, validate against the Zod schema
4. **On failure: exactly one corrective retry**, telling the model what was wrong
5. On a second failure: **throw** — a malformed object never reaches downstream code
6. Emit usage (agent, provider, model, tokens in/out, cost, latency) to the sink,
   which writes a `UsageLog` row

### Model routing — `src/llm/model-routing.ts`

| Tier | Model | Agents |
|---|---|---|
| CHEAP | `gemini-3.5-flash-lite` | ParseResume, ParseJD, InterviewPrep, NaukriScore, TierCalibration, ReferralMessage |
| MID | `gemini-3.6-flash` | SemanticMatch, Quality, RecruiterComment |
| FRONTIER | `gemini-3.5-flash` | Roadmap, Rewrite, Verify |

Per-agent override without code changes:
`MODEL_OVERRIDE_<AGENT_NAME>="provider:model"`.

**Important:** the safety-critical `RewriteAgent` and `VerifyAgent` currently
run on a **flash-class** model, not a dedicated reasoning tier. The code
comments record why: `gemini-2.5-pro` has zero free-tier quota on this key and
`gemini-2.5-flash` 404s for new accounts.

### Vector search — `src/vector/`
`PgVectorStore.matchCandidates(resumeTerms, jdTerms, threshold = 0.6)` embeds
terms (cached in `SkillEmbedding`) and returns candidate pairs using pgvector's
cosine-distance operator (`1 - (a <=> b)`). Feeds `SemanticMatchAgent`.

---

## 15. AI agents

Located in `backend/src/agents/`. Sixteen files: twelve LLM agents, two
pure-code units, plus `types.ts` and `_template.ts`.

| Agent | Purpose | Input | Output | Tier | Kind | Status |
|---|---|---|---|---|---|---|
| `ParseResumeAgent` | Raw text → structure | resume text | `ParsedResume` | cheap | LLM | **IMPLEMENTED** |
| `ParseJDAgent` | Raw text → structure | JD text | `ParsedJD` | cheap | LLM | **IMPLEMENTED** |
| `DeterministicCheckAgent` | Keywords, metrics, verbs, contact, gaps | resume + JD | `DeterministicResult` | — | **pure code, 0 cost** | **IMPLEMENTED** |
| `SemanticMatchAgent` | Meaning-level matching, seniority/domain fit | resume, JD, vector candidates, options | `SemanticMatchResult` | mid | LLM + pgvector | **IMPLEMENTED** |
| `QualityAgent` | Section scores, weak bullets | resume | `QualityResult` | mid | LLM | **IMPLEMENTED** |
| `NaukriScoreAgent` | Portal score + gap reason | resume, JD, deterministic | `NaukriResult` | cheap | LLM | **IMPLEMENTED** |
| `TierCalibrationAgent` | Startup/MNC/PSU/Government adjustment | resume, tier | notes | cheap | LLM | **IMPLEMENTED** |
| `ScoreAggregator` | Final weighted score + categories | all of the above | `ScoreResult` | — | **pure arithmetic** | **IMPLEMENTED** |
| `RoadmapAgent` | Ranked fixes with gain + confidence | score, deterministic, semantic, quality | `RoadmapItem[]` | frontier | LLM | **IMPLEMENTED** |
| `RewriteAgent` | Improved resume + change summary | original, roadmap, flagged claims | resume + summary | frontier | LLM | **IMPLEMENTED** |
| `VerifyAgent` | Trace every claim to the original | original, rewritten | `{passed, flaggedClaims}` | frontier | LLM | **IMPLEMENTED** |
| `RecruiterCommentAgent` | Six-second recruiter read | resume, JD | comments | mid | LLM | **PARTIAL — generated on every rewrite, then discarded; never reaches the UI** |
| `InterviewPrepAgent` | Technical + HR questions with reasons | resume, JD | `{technical[], hr[]}` | cheap | LLM | **PARTIAL — no UI** |
| `ReferralMessageAgent` | Referral message text | — | message | cheap | LLM | **PARTIAL — not wired to any endpoint** |

Each agent file contains its own Zod `OutputSchema`, a `buildPrompt()`
function, and a `run…Agent()` entry point. Fifteen also export a `goldenTests`
array — **no test runner consumes them** (§23).

---

## 16. Orchestration

### ScanPipeline — `src/orchestrator/scan-pipeline.ts`

```
Wave 1 (parallel, 2 LLM calls)
   ParseResumeAgent ∥ ParseJDAgent
        ↓
   PgVectorStore.matchCandidates()      embed + cosine search
        ↓
Wave 2 (deterministic runs free, 4 LLM calls in parallel)
   DeterministicCheckAgent (0 calls)
   SemanticMatchAgent ∥ QualityAgent ∥ NaukriScoreAgent ∥ TierCalibrationAgent
        ↓
   ScoreAggregator (0 calls, pure arithmetic)
        ↓
Wave 3 (1 LLM call)
   RoadmapAgent   ← needs the score as input
        ↓
   ScanPipelineResult
```

≈7 LLM calls per scan. Two entry points: `run()` from raw text and
`runFromStructured()` from already-parsed objects — the latter is what the
rewrite pipeline re-scores through, and is exactly what a future rescan
endpoint would reuse.

### RewritePipeline — `src/orchestrator/rewrite-pipeline.ts`

```
RewriteAgent
   ↓
VerifyAgent ──passed──→ parallel: ScanPipeline.runFromStructured()
   │                              ∥ RecruiterCommentAgent
   │                              ∥ InterviewPrepAgent
   │                                    ↓
   │                            { status: "verified", resume, changeSummary,
   │                              rescored, recruiterComments, interviewPrep }
   │
   └──failed──→ re-prompt RewriteAgent with the flagged claims
                (up to maxRetries = 2)
                     ↓ still failing
                { status: "verification_failed",
                  resume: THE ORIGINAL,
                  flaggedClaims }
```

### Answers to the orchestration questions
- **Who calls agents?** Only the two pipelines. `ScanService` calls pipelines.
- **Sequential or parallel?** Both — parallel within a wave, sequential between.
- **If an agent fails?** The exception propagates; `ScanService` marks the scan
  `FAILED` with the message and rethrows. **There is no per-agent fallback or
  partial-result path** — one failed agent fails the whole scan.
- **Context passing?** Plain typed objects (`src/agents/types.ts`). No shared
  mutable state, no conversation memory.
- **Output validation?** Zod at the provider boundary, with one repair retry.
- **Hallucination control?** `VerifyAgent` + the fail-closed loop (§19).
- **Final score?** Pure arithmetic in `ScoreAggregator` (§18).

---

## 17. Prompts

**There is no prompts directory and no template files.** Every prompt is a
`buildPrompt()` function inside its own agent file, co-located with the Zod
schema it must satisfy.

| Aspect | Implementation |
|---|---|
| Location | `backend/src/agents/<name>.agent.ts` |
| Shape | Template literal built from typed inputs |
| Output contract | Zod `OutputSchema` in the same file |
| Validation | `completeStructured()` — parse → validate → one corrective retry → throw |
| Versioning | **NOT IMPLEMENTED** — no prompt versioning or registry |
| A/B testing | **NOT IMPLEMENTED** |

`_template.ts` is a scaffold for writing new agents in the same shape.

---

## 18. Scan pipeline & scoring engine

### The scoring engine — `src/agents/score-aggregator.ts`

**No LLM is involved in producing the final number.** The model contributes
*inputs*; the score is fixed-weight arithmetic. This is what makes the score
reproducible and lets every category declare its provenance.

```
WEIGHTS = { keyword: 30, experience: 20, bullets: 20, structure: 15, contact: 15 }
```

| Category | Formula | Source label |
|---|---|---|
| Keyword coverage | `round(exactMatchPct / 100 × 30)` | `code` |
| Experience fit | `round(experienceFitScore / 100 × 20)` | `llm` |
| Bullet quality | `round(bulletQualityScore / 100 × 20)` | `llm` |
| Structure | `round(sectionsPresent / 5 × 15)` — summary, experience, projects, skills, education | `code` |
| Contact & format | `contactValid ? 15×0.7 : 15×0.2` + `(fieldsPresent/4) × 15×0.3`, capped at 15 | `code` |

`generic = Σ earned` (max 100). Each category carries `{earned, max, reason, source}`.

**Separately produced, not part of the sum:**
- `naukri` — `NaukriScoreAgent`, model-estimated
- `exactMatch` — `found / uniqueJdSkills × 100`, deterministic
- `semanticMatch` — `SemanticMatchAgent`, model-estimated
- `gapReason` — model-written explanation of the portal gap

### Deterministic checks — `src/agents/deterministic-check.agent.ts`
Contact validity (email contains `@`, phone ≥10 digits), word count, timeline
gaps >6 months, action-verb density, metric-bearing bullet ratio, exact keyword
match over unique JD skills, missing keywords with `priority`
(`critical` if a must-have, else `important`) and a `where` hint, and overused
weak openers ("responsible for", "worked on", "helped", "involved in",
"assisted with").

### Derived in the frontend, not the backend
- **Per-keyword impact** = `keywordCategory.max / totalJdSkills`
  (`frontend/src/features/analysis/reportData.js`). For a 10-requirement
  posting that is **+3.0 points**, badged LOCAL. Derived from the two formulas
  above, not estimated.
- **Resume quality ring** = mean of `quality.sections[].score`, falling back to
  `bulletQualityScore`. Badged MODEL.

### Thresholds — `frontend/src/design-system/tokens.js`
`<55` critical · `<75` warning · `≥75` good, with `scoreLabel()` producing
"Weak match" / "Partial match" / "Strong match" for screen readers.

---

## 19. Optimization & AI safety

### Current flow

```
Report → Fixes tab → "Rewrite with AI"
        ↓  POST /scan/:id/rewrite
   RewriteAgent → VerifyAgent (≤2 retries)
        ↓
  ┌─────────────────────┬──────────────────────────┐
  │ verified            │ verification_failed      │
  │ • rewritten resume  │ • ORIGINAL returned      │
  │ • changeSummary     │ • flaggedClaims listed   │
  │ • rescored score    │ • nothing changed        │
  │ • prep set created  │ • unverified version     │
  │ • recruiterComments │   stored with            │
  │   (discarded by UI) │   verified: false        │
  └─────────────────────┴──────────────────────────┘
```

**NOT IMPLEMENTED:** per-change accept/reject/edit UI, persistence of user
decisions, re-scoring the user's accepted subset, and a dedicated before/after
screen.

### AI safety — what actually exists

| Safeguard | Implementation | Status |
|---|---|---|
| Structured-output validation | Zod schema per agent, one corrective retry, then throw | **IMPLEMENTED** |
| Claim traceability | `VerifyAgent` compares rewritten vs original | **IMPLEMENTED** |
| Fail-closed | On exhausted retries the pipeline returns the **original** resume plus flagged claims — it never ships an unverified rewrite | **IMPLEMENTED** |
| Original preservation | The `kind:"original"` `ResumeVersion` is written at scan time and never mutated | **IMPLEMENTED** |
| Unverified output marking | Failed rewrites are stored with `verified: false` and `flagged` populated | **IMPLEMENTED** |
| Provenance surfaced to the user | `source: "code" \| "llm"` rendered as LOCAL/MODEL on every score row | **IMPLEMENTED** |
| Confidence surfaced | `RoadmapItem.conf` rendered as bars + word | **IMPLEMENTED** |
| Targeted number/date/company checks | — | **NOT IMPLEMENTED** as discrete checks; `VerifyAgent` handles claims generically |
| Automated hallucination testing | — | **NOT IMPLEMENTED** — see §23 |

> **This system is not hallucination-proof.** Verification is itself an LLM
> judgement, currently running on a flash-class model, with no test suite
> measuring its precision or recall.

---

## 20. Feature-by-feature status

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

---

## 21. Environment variables

From `backend/.env.example`. **No values are reproduced here.**

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection (needs pgvector) | **Yes** | `postgresql://user:<REDACTED>@localhost:5434/parse_dev?schema=public` |
| `REDIS_URL` | Redis connection | Recommended — degrades gracefully | `redis://localhost:6380` |
| `ANTHROPIC_API_KEY` | Anthropic provider | At least one LLM key | `<REDACTED>` |
| `OPENAI_API_KEY` | OpenAI provider | At least one LLM key | `<REDACTED>` |
| `GEMINI_API_KEY` | Gemini provider — **the only one provisioned** | At least one LLM key | `<REDACTED>` |
| `JWT_SECRET` | Access-token signing | **Yes** | `<REDACTED>` |
| `JWT_REFRESH_SECRET` | Refresh-token signing | **Yes** | `<REDACTED>` |
| `GOOGLE_CLIENT_ID` | Google SSO | No — strategy skipped if unset | `<REDACTED>` |
| `GOOGLE_CLIENT_SECRET` | Google SSO | No | `<REDACTED>` |
| `GOOGLE_CALLBACK_URL` | Google SSO redirect | No | `http://localhost:3000/auth/google/callback` |
| `RAZORPAY_KEY_ID` | Payments | No — **no code reads it** | `<REDACTED>` |
| `RAZORPAY_KEY_SECRET` | Payments | No — **no code reads it** | `<REDACTED>` |
| `RAZORPAY_WEBHOOK_SECRET` | Payments | No — **no code reads it** | `<REDACTED>` |
| `WHATSAPP_TOKEN` | WhatsApp | No — **no code reads it** | `<REDACTED>` |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp | No — **no code reads it** | `<REDACTED>` |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | No — **no code reads it** | `<REDACTED>` |
| `PORT` | Backend port | No — defaults to 3000 | `3000` |

Frontend variable (not in any `.env.example`, passed at run time):

| Variable | Purpose | Required |
|---|---|---|
| `VITE_API_ORIGIN` | Proxy target for `/api` | No — defaults to `http://localhost:3000` |

---

## 22. Running the project

### Prerequisites

| Requirement | Verified from |
|---|---|
| Node.js | **No `engines` field in either `package.json`.** Verified working on **v24.14.0**. Vite 5 requires ≥18 |
| Package manager | **npm** — both projects have `package-lock.json`, no pnpm/yarn/bun lockfile |
| PostgreSQL | With the `vector` extension available |
| Redis | Optional — the app degrades gracefully without it |
| Docker | Optional; only used to host Postgres/Redis locally. **No Dockerfile or compose file exists in this repository** |

### 1. Install

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Services

There is no committed compose file. These are the exact commands used to bring
the services up locally (ports match `backend/.env`):

```bash
docker run -d --name parse-postgres \
  -e POSTGRES_PASSWORD=<your-password> -e POSTGRES_DB=parse_dev \
  -p 5434:5432 pgvector/pgvector:pg17

docker run -d --name parse-redis -p 6380:6379 redis:7-alpine

docker exec parse-postgres psql -U postgres -d parse_dev \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

### 3. Environment

```bash
cd backend && cp .env.example .env
# fill DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET,
# and at least one LLM key
```

### 4. Database

Scripts verified in `backend/package.json`:

```bash
npx prisma migrate dev --name init   # or: npm run prisma:migrate
npm run prisma:generate
```

**No seed script exists.**

### 5. Run

```bash
# terminal 1
cd backend && npm run start:dev          # http://localhost:3000

# terminal 2
cd frontend && npm run dev               # http://localhost:5173, proxies /api → :3000
```

If the default ports are taken:

```bash
PORT=3001 npm run start:dev
VITE_API_ORIGIN=http://localhost:3001 npx vite --port 5188 --strictPort
```

### 6. First run

1. Open the frontend → **Analyse my resume** → create an account
2. Onboarding: experience + target tier (both skippable)
3. Analyse: paste a resume and a full job description
4. Wait ~30 s → the report opens on **Overview**

### Build

```bash
cd backend  && npm run build      # nest build → dist/
cd frontend && npm run build      # vite build → dist/
cd frontend && npm run preview    # serve the production build
```

---

## 23. Testing

> **Status: NOT IMPLEMENTED.**

| Kind | Command | Location | Status |
|---|---|---|---|
| Backend unit | `npm test` (jest configured) | — | **No test files exist** |
| Golden-set agent tests | `npm run test:golden` | 15 agents export a `goldenTests` array | **Data exists; nothing executes it** |
| Frontend | — | — | **No test runner configured** |
| E2E | — | — | **Not implemented** |
| AI / hallucination evaluation | — | — | **Not implemented** |

`backend/package.json` defines `test` and `test:golden` scripts pointing at
jest, and jest is installed — but a repository-wide search for `*.spec.*`,
`*.test.*` and `*e2e*` returns nothing.

**This is the single largest risk in the project.** `VerifyAgent` — the
fail-closed guard the product's core claim depends on — has no automated
coverage of any kind.

---

## 24. Deployment, CI/CD, observability

### Deployment
**NOT FOUND IN CURRENT REPOSITORY.** No Dockerfile, no `docker-compose.yml`,
no Kubernetes manifests, no Vercel/Netlify/Render/Fly configuration, no
`Procfile`, no deployment scripts. There is no staging or production
environment described anywhere in the repository.

### Version control / CI
**The project directory is not a git repository** (`git rev-parse` fails).
There is therefore **no commit history to inspect**, no branches, no
`.github/` directory, and no pipeline of any kind.

> Consequence: the "completed work" in §28 is derived from reading the code and
> running the application, not from commit history.

### Observability

| Capability | Status |
|---|---|
| Per-LLM-call telemetry | **IMPLEMENTED** — `UsageLog` rows record agent, provider, model, tokens in/out, cost, latency, cache-hit |
| Cost tracking | **PARTIAL — computes 0.** `RATE_CARD` in `model-routing.ts` has `0.0` for all three Gemini models, so `estimateCostUsd()` returns 0 for every call actually being made |
| Latency tracking | **IMPLEMENTED** via `UsageLog.latencyMs` |
| Application logging | NestJS default logger + `console.warn/error` |
| Error monitoring | **NOT IMPLEMENTED** — no Sentry or equivalent |
| Metrics / tracing | **NOT IMPLEMENTED** |
| Audit logs | **NOT IMPLEMENTED** |
| Frontend analytics | **PARTIAL** — `services/analytics.js` defines the full event taxonomy and a `track()` that only `console.debug`s in dev. No provider, no ingestion endpoint |

---

## 25. Security & performance

### Implemented
- bcrypt password hashing; refresh tokens stored hashed, rotated on use
- JWT with expiry enforced (`ignoreExpiration: false`)
- Global `ValidationPipe({ whitelist: true })` — unknown request properties are stripped
- DTO validation on scan and auth inputs (minimum lengths, email format, enum for tier)
- Client-side file validation: type allow-list and a 5 MB cap before upload
- Cache keys include scan options, preventing cross-option result bleed
- Scan ownership enforced on `GET /scans`

### Not implemented / risks
| Concern | State |
|---|---|
| CORS | `app.enableCors()` with **no options** — currently allows all origins |
| Rate limiting | `checkRateLimit()` exists and **is never called** |
| `GET /scan/:id` | **Unguarded.** Anyone with the cuid reads that resume and JD |
| Token storage | `localStorage`, not httpOnly cookies — XSS-exposed |
| Logout | Does not revoke refresh tokens server-side |
| Server-side file limits | None — the backend receives text, the browser enforces the cap |
| Secrets | Real values live in `backend/.env`, which is not committed. `.gitignore` exists |
| Payment verification | N/A — no payment code |
| Helmet / CSP / HSTS | **NOT IMPLEMENTED** |

### Performance
- **Implemented:** 30-day Redis result cache (a cache hit skips ~7 LLM calls
  entirely); `SkillEmbedding` caches embeddings across users; parallel waves;
  two of the pipeline's units cost nothing; database indexes on all lookup paths
- **Not implemented:** queues/background jobs, HTTP response caching,
  frontend code-splitting (the bundle is ~745 kB, ~225 kB gzipped, and Vite
  warns about it), lazy loading, pagination beyond `take` on `/scans`

---

## 26. Failure handling

| Failure | Behaviour | Status |
|---|---|---|
| PDF unreadable / image-only | Caught **in the browser** before any request; the UI offers a paste box | **IMPLEMENTED** |
| Unsupported file type | Client-side allow-list, explicit message | **IMPLEMENTED** |
| File >5 MB | Client-side rejection | **IMPLEMENTED** |
| JD too short | Warning at 200 characters; submission still allowed above 20 | **IMPLEMENTED** |
| Resume/JD below 20 chars | DTO validation rejects with a readable message | **IMPLEMENTED** |
| LLM call fails | Exception propagates → scan marked `FAILED` with the message → 500. UI shows an error with "your resume is safe and no credit has been used" | **IMPLEMENTED** |
| LLM returns malformed JSON | One corrective retry, then throw | **IMPLEMENTED** |
| Verification fails | Original resume returned with flagged claims; nothing changed | **IMPLEMENTED** |
| Redis unavailable | Silently degrades — cache miss, rate limiter fails open | **IMPLEMENTED** |
| Database unavailable | Unhandled — request fails with a 500 | **PARTIAL** |
| Access token expired | Silent refresh, one retry, then sign-out preserving destination | **IMPLEMENTED** |
| Insufficient credits | **NOT IMPLEMENTED** — no credit checks exist |
| Payment failure | **NOT IMPLEMENTED** |
| Frontend render error | `ErrorBoundary` per route with a recovery action | **IMPLEMENTED** |

Note the refund comment in `ScanService`: FR-20 credit refund on pipeline
failure is a documented no-op until credits are wired.

---

## 27. Data flow

```
User picks a PDF
      ↓  pdfjs-dist extracts text IN THE BROWSER (unreadable files cost nothing)
Frontend validates (type, size, length) and reads tier + fresherMode
      ↓  POST /api/scan  → Vite proxy → NestJS
OptionalJwtGuard attaches req.user if a token is present
      ↓
ValidationPipe → CreateScanDto
      ↓
ScanService.createScan()
      ↓
   cacheKey = sha256(resume + jd + tier + fresherMode)
      ↓
   Redis hit? ──yes──→ attributeCachedScan() ──→ return (no LLM calls)
      │ no
      ↓
   Scan row created with status RUNNING
      ↓
   ScanPipeline
      Wave 1  ParseResume ∥ ParseJD
      pgvector embed + cosine candidate search
      Wave 2  Deterministic (free) ∥ Semantic ∥ Quality ∥ Naukri ∥ TierCalibration
              ScoreAggregator (pure arithmetic)
      Wave 3  RoadmapAgent
      ↓  every call writes a UsageLog row
   Scan updated → status COMPLETE, JSON columns populated
   ResumeVersion { kind: "original" } created
   Redis cache written (30-day TTL)
      ↓
201 with the full Scan row
      ↓
Frontend navigates to /report/:id → GET /scan/:id
      ↓
mapScanToReport() — the single API→UI seam; derives per-keyword impact,
                    quality average, strengths/problems, display casing
      ↓
Six panels render
```

---

## 28. Completed work

Derived from reading the code and running the application — **not** from commit
history, which does not exist (§24).

### Backend — pre-existing
- NestJS scaffold; Prisma schema with all 10 models; migrations applied
- `completeStructured()` LLM abstraction over three providers with Zod
  validation and a corrective retry
- 14 agents including two zero-cost pure-code units
- `ScanPipeline` (3 waves) and `RewritePipeline` with the fail-closed retry loop
- pgvector store with embedding cache
- Redis result caching keyed on scan options
- Email auth with JWT + rotating refresh tokens; Google strategy conditionally registered
- Per-LLM-call `UsageLog` telemetry

### Backend — this session
- **BE-1: scan ownership** — `OptionalJwtGuard`, `JwtAuthGuard`, `userIdOf()`;
  `POST /scan` attributes scans; new `GET /scans` returning a summary projection
- **Cache/ownership reconciliation** — `attributeCachedScan()` (claim / return / copy)

### Frontend — this session (built from nothing but two prototype screens)
- **Design system**: tokens, base layer, ~20 components, self-hosted IBM Plex
  via Fontsource, Lucide icons, `/design-system` reference page
- **App shell**: collapsible sidebar (rail-forced on report routes), top bar,
  bottom nav, `Page`/`Grid`/`Split`, error boundaries, skip link, focus management
- **Core flow**: landing, sign-in/sign-up, onboarding, dashboard on server data,
  two-column analyse screen, honest staged processing
- **Auth plumbing**: `AuthContext`, refresh-on-401 with a shared in-flight
  promise, intended-destination redirect
- **Report**: rebuilt from a 480px prototype into a 1200px six-panel screen —
  Overview, Score, Keywords, Quality, Fixes, Prep (locked); mobile drops tabs
  for accordions
- **Analytics taxonomy** (`services/analytics.js`), dev-only

### Verified by running, not by inspection
- Full scan: **HTTP 201 in ~30 s**, coherent output (43 generic / 48 Naukri,
  7 missing keywords, 6 weak bullets, 4 roadmap items)
- Signup → onboarding → dashboard → analyse → processing → report → listed on dashboard
- Auth wall → sign in → return to intended page
- BE-1: 401 without token, cached scan attributed, anonymous scan still works
- No console errors; no horizontal overflow at 1440 / 1024 / 834 / 390
- Production builds clean on both sides

### Bugs found and fixed
Twelve, listed in [`BUILD-LOG.md`](BUILD-LOG.md) §8. Nine were found by running
the application, not by reading it — including a cache/ownership bug that
returned another user's scan row, and a paste field that unmounted while being
typed into.

---

## 29. Partially completed work

| Feature | Current state | Missing |
|---|---|---|
| Google SSO | Strategy + routes exist, conditionally registered | Credentials; callback redirects to the frontend instead of returning JSON |
| Interview prep | Agent, storage, endpoint | UI; decoupling from the rewrite; the brief's 6 categories (only technical + hr exist) |
| Resume optimization | Rewrite, verification, re-score, both outcomes handled | Per-change accept/reject/edit; decision persistence; re-score on the accepted subset; before/after screen |
| Resume versions | `ResumeVersion` written on scan and rewrite; `/diff` works | No UI; no `Resume` parent entity, so lineage is per-scan |
| Redis | Caching | Rate limiter never called; no invalidation |
| Credits | Schema only | Every read, write, check, and refund path |
| Analytics | Event taxonomy + `track()` | Provider, ingestion, call sites beyond auth/scan |
| Cost telemetry | Rows written | Real `RATE_CARD` values — currently records 0 |
| Recruiter comment | Generated every rewrite | Not returned by `GET /scan/:id`; discarded |
| Referral message | Agent implemented | Not wired to any endpoint |
| Legacy `signal/` | Retained for `SignIn` | Migration of `SignIn` onto the design system |

---

## 30. Remaining tasks & roadmap

### P0 — Critical

| Task | Why | Depends on | Files | Complexity |
|---|---|---|---|---|
| Write the test suite, starting with `VerifyAgent` | The product's core claim has zero coverage; `npm test` runs against nothing | — | `backend/src/agents/*`, new `*.spec.ts` | High |
| Hallucination evaluation fixtures | Must prove the verifier fails closed on invented metrics, employers, dates, seniority — and does **not** flag legitimate rephrasing | Test suite | new | High |
| `POST /scan/:id/rescan` (**BE-2**) | Without it the "after" score describes a resume the user did not accept | — | `scan.controller.ts`, `scan.service.ts` (wraps existing `runFromStructured()`) | Low |
| Optimize UI: accept / reject / edit per change | The trust step the whole product rests on | BE-2, BE-4 | new `features/optimization/` | High |
| Lock down CORS; call the rate limiter | Currently all origins allowed; limiter dead code | — | `main.ts`, `scan.controller.ts` | Low |

### P1 — Launch

| Task | Why | Depends on | Complexity |
|---|---|---|---|
| Interview prep UI + **BE-6** (decouple from rewrite) | Built and paid for, invisible | — | Medium |
| Credits: ledger writes, balance, spend, refund (**BE-7**) | Free/paid gating and the refund promise in error copy | — | Medium |
| Razorpay order + webhook (**BE-8**) | Revenue | BE-7 | Medium |
| `Scan.stage` + polling (**BE-3**) | Full staged processing screen | — | Low |
| Real `RATE_CARD` values (**BE-10**) | Cost telemetry currently records 0 | — | Trivial |
| Expose `recruiterComments` (**BE-9**) | Already generated and discarded | — | Trivial |
| Forgot-password endpoint + screen | No recovery path exists | — | Medium |
| Deployment: Dockerfile, compose, CI | None exists | — | Medium |
| **Initialise git** | No version control at all | — | Trivial |

### P2 — Post-launch
`Resume` entity and library (**BE-5**), version compare UI, settings + privacy
controls (delete resume/account), analytics provider (**BE-11**), WhatsApp
receiver, multi-provider routing restored, application tracking, interview
readiness as measured gap coverage, React Query adoption, code-splitting.

### P3 — Future
Practice answers, voice/video mock interviews, LinkedIn and portfolio analysis,
campus/placement dashboards, portal scoring beyond Naukri, recruiter view,
resume A/B testing, regional languages.

### Phase roadmap (adapted to actual state)

| Phase | Scope | Status |
|---|---|---|
| 0 — Audit | Repository audit, design system spec, screen specs | **DONE** |
| 1 — Design system | Tokens, fonts, ~20 components | **DONE** |
| 2 — Application shell | Sidebar, top bar, bottom nav, layout, error boundary | **DONE** |
| 3 — Core flow | Landing, auth, onboarding, dashboard, analyse, processing + BE-1 | **DONE** |
| 4 — Analysis experience | Six-panel report at desktop width; 3 audit bugs fixed | **DONE** |
| 5 — Optimization | Diff, accept/reject, verification states, before/after | **NEXT** |
| 6 — Interview prep | Weak areas, questions, detail | Planned |
| 7 — Resume management | Library, versions, compare | Planned (needs BE-5) |
| 8 — Auth & ownership | Guard + ownership | **DONE early** (BE-1, shipped in Phase 3) |
| 9 — Monetisation | Credits, Razorpay, paywalls | Planned |
| 10 — Testing | Unit, integration, AI eval, E2E | Planned — **should be continuous, not a phase** |
| 11 — Performance & security | CORS, rate limits, OWASP, monitoring, backups | Planned |
| 12 — Real-user validation | 20–30 users, funnel + qualitative | Planned — the project's kill switch |
| 13 — Launch | MVP | Planned |
| 14 — Post-launch | WhatsApp, mock interviews, advanced analytics | Planned |

---

## 31. Blockers, known bugs, technical debt

### Current blockers

| Blocker | Impact | Resolution |
|---|---|---|
| Only `GEMINI_API_KEY` provisioned | All agents route to Gemini; safety-critical agents run on a flash-class model | Add Anthropic/OpenAI keys, restore the routing table |
| No `pro`-tier Gemini quota on this key | `RewriteAgent`/`VerifyAgent` cannot use a reasoning model | Enable billing or add another provider |
| No git repository | No history, no branches, no CI, no rollback | `git init` |
| No deployment configuration | Cannot ship | Author Dockerfile + compose + pipeline |
| Outbound network unreliable in the current environment | One live scan failed with `fetch failed`; npm and Google Fonts were unreachable at points | Environmental, not code |

### Known bugs

No `TODO`, `FIXME`, `HACK` or `XXX` markers exist anywhere in `backend/src` or
`frontend/src`. The twelve bugs found this session were all fixed; see
[`BUILD-LOG.md`](BUILD-LOG.md) §8. Remaining defects:

| Bug | Severity | Location | Description | Fix |
|---|---|---|---|---|
| Cost telemetry always 0 | Medium | `model-routing.ts` `RATE_CARD` | Gemini rates are `0.0`, so every `UsageLog.costUsd` is 0 | Fill in verified per-token rates |
| Rate limiter is dead code | Medium | `redis.service.ts` | `checkRateLimit()` never called; no abuse protection | Call it in `ScanController` |
| CORS allows all origins | Medium | `main.ts` | `enableCors()` with no options | Restrict to the real origin |
| Google callback returns JSON | Low | `auth.controller.ts` | Marked "wiring TBD"; unusable from a browser flow | Redirect with a short-lived code |
| No favicon | Cosmetic | `frontend/index.html` | 404 on every page load | Add one |
| `README.md` partly stale | Low | root | Describes E5/E6/E8 as not done and cites a `PARSE_Master_Plan.md` absent from the repo | Refresh or point at `PROJECT.md` |

### Technical debt

| Debt | Where | Why it matters |
|---|---|---|
| **No tests at all** | whole repo | Every change is unverified; the safety claim is untested |
| Prompts inline in agents | `agents/*.agent.ts` | No versioning or A/B testing; prompt edits are invisible in review |
| Server state hand-rolled | every screen | `useEffect` + `useState` per fetch; no caching, retry, or dedupe. React Query was specified and not adopted |
| Legacy `signal/` alongside `design-system/` | `frontend/src/signal/` | Two token sources; only `SignIn` still uses the old one |
| `screens/` vs `features/` vs `pages/` | frontend | Three folders with overlapping roles mid-migration |
| Pipeline runs inside the request | `scan.service.ts` | A ~30 s synchronous HTTP request; no queue, no progress, no resumability |
| Scan JSON columns unqueryable | `schema.prisma` | Fine today; blocks analytics over score history later |
| `dump.rdb` committed at root | root | Stray artifact |
| No `engines` field | both `package.json` | Node version drift between machines |

---

## 32. Architectural decisions

Documented where the repository states a rationale.

| Decision | Rationale | Source |
|---|---|---|
| Vite + React Router over Next.js | No SEO requirement, distribution is WhatsApp + placement cells, no SSR need behind an auth wall, NestJS already serves the API | `vite.config.js` comment |
| Score computed in code, not by an LLM | Reproducibility and per-category provenance; gives the contribution bar, penalty breakdown and client-side simulator for free | `score-aggregator.ts` |
| Two zero-cost agents | Keyword/format checks and aggregation need no model; cheaper and deterministic | `deterministic-check.agent.ts` |
| Fail-closed verification | The source plan's loop shipped the unverified rewrite after exhausting retries, contradicting the reliability requirement; corrected to return the original | `rewrite-pipeline.ts` |
| Cache key includes scan options | A resume scored as PSU is not the same scan as scored for a Startup | `redis.service.ts` |
| Provider abstraction from day one | "Retrofitting a second provider is where abstractions leak" | `README.md`, `llm-provider.ts` |
| Append-only credit ledger | Auditable; never a mutable balance integer | `schema.prisma` |
| Prisma 7 driver adapter | Prisma 7 removed `url` from the schema; migrated for real rather than pinning | `README.md`, `prisma.config.ts` |
| TypeScript held at 5.x | `ts-node`/`ts-jest` compatibility with TS7 internals unverified; not worth gambling the toolchain | `README.md` |
| Gemini-only routing | Only key provisioned; tiering preserved using Gemini's own model classes | `model-routing.ts` |
| Sidebar auto-collapses on report routes | Content width is worth more than labels on the widest screen | `AppShell.jsx` |
| Report link unguarded | WhatsApp deep links must open for people with no account | `scan.controller.ts` |
| `mapScanToReport()` as the only API→UI seam | A backend field rename touches one function | `reportData.js` |
| Bottom nav rendered, not CSS-hidden | A `display:none` nav is still in the accessibility tree | `AppShell.jsx` |

**Decisions that exist without a documented rationale:** choice of NestJS,
PostgreSQL, Prisma, Redis, and bcrypt. All are conventional; no ADR exists.

---

## 33. New developer onboarding

### If you join today

```bash
# 1. install
cd backend && npm install && cd ../frontend && npm install

# 2. services (no compose file exists — these are the exact commands)
docker run -d --name parse-postgres -e POSTGRES_PASSWORD=<pw> \
  -e POSTGRES_DB=parse_dev -p 5434:5432 pgvector/pgvector:pg17
docker run -d --name parse-redis -p 6380:6379 redis:7-alpine
docker exec parse-postgres psql -U postgres -d parse_dev \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 3. env
cd backend && cp .env.example .env    # fill DB, Redis, JWT secrets, one LLM key

# 4. database
npx prisma migrate dev --name init && npm run prisma:generate

# 5. run
npm run start:dev                      # :3000
cd ../frontend && npm run dev          # :5173

# 6. exercise it
#    create an account → onboarding → paste a resume + a full JD → analyse
#    → read the report → open /design-system to see the component set
```

### Reading order

| # | File | Why |
|---|---|---|
| 1 | `PROJECT.md` | Motive and scope in ten minutes |
| 2 | `backend/prisma/schema.prisma` | The data model is the real contract |
| 3 | `backend/src/agents/types.ts` | Every shape passed between agents |
| 4 | `backend/src/orchestrator/scan-pipeline.ts` | How a scan actually runs |
| 5 | `backend/src/agents/score-aggregator.ts` | Where the number comes from |
| 6 | `backend/src/orchestrator/rewrite-pipeline.ts` | The fail-closed loop — the product's core claim |
| 7 | `backend/src/llm/llm-provider.ts` | Validation and retry at the model boundary |
| 8 | `backend/src/scan/scan.service.ts` | Caching, ownership, persistence |
| 9 | `frontend/src/App.jsx` | Routes and shells |
| 10 | `frontend/src/features/analysis/reportData.js` | The API→UI seam |
| 11 | `frontend/src/features/analysis/ReportPage.jsx` | The most important screen |
| 12 | `frontend/src/design-system/tokens.css` | Every visual value |
| 13 | `DESIGN-AND-ROADMAP.md` | Where it is going |
| 14 | `BUILD-LOG.md` | What already went wrong, and why |

### Most important files

| File | Why it matters |
|---|---|
| `backend/src/orchestrator/scan-pipeline.ts` | The analysis, wave by wave |
| `backend/src/orchestrator/rewrite-pipeline.ts` | Fail-closed verification |
| `backend/src/agents/score-aggregator.ts` | The scoring engine |
| `backend/src/agents/deterministic-check.agent.ts` | Everything measured without a model |
| `backend/src/llm/llm-provider.ts` | Structured output, validation, retry, telemetry |
| `backend/src/llm/model-routing.ts` | Which model each agent gets, and the rate card |
| `backend/src/scan/scan.service.ts` | Cache, ownership, scan lifecycle |
| `backend/prisma/schema.prisma` | Data model |
| `frontend/src/features/analysis/reportData.js` | The one API→UI seam |
| `frontend/src/design-system/tokens.css` | Design system source of truth |
| `frontend/src/layouts/AppShell.jsx` | Navigation and responsive behaviour |

---

## 34. Glossary

| Term | Meaning in this project |
|---|---|
| **ATS** | Applicant Tracking System — software that parses and ranks resumes before a human sees them |
| **JD** | Job description — the posting a resume is analysed against |
| **Scan** | One analysis of one resume against one JD with one set of options; a database row |
| **Match score** | `score.generic` — the headline 0–100, computed by `ScoreAggregator` |
| **Portal score** | `score.naukri` — how a Naukri-style parser would read the resume |
| **Portal gap** | `generic − naukri`. Positive = weaker on the portal |
| **Exact match** | Literal keyword overlap, `found / uniqueJdSkills` — deterministic |
| **Semantic match** | Meaning-level match from embeddings + model judgement |
| **Agent** | One unit of the pipeline with a single responsibility, a prompt, and a Zod output schema. Two are pure code |
| **Orchestrator / pipeline** | `ScanPipeline` and `RewritePipeline` — the only callers of agents |
| **Wave** | A group of agents run in parallel; waves run in sequence |
| **LOCAL / MODEL** | UI badges for `ScoreCategory.source` — arithmetic vs model judgement |
| **Verification** | `VerifyAgent` tracing every claim in a rewrite back to the original |
| **Fail-closed** | On exhausted retries, return the original resume rather than an unverified rewrite |
| **Flagged claim** | A statement the verifier could not trace to the original |
| **Resume version** | `kind: "original"` or `"rewritten"`, with `verified` and `flagged` |
| **Re-score** | Running the scan pipeline again over a rewritten resume |
| **Roadmap** | Ranked fixes with `gain` (estimated points) and `conf` |
| **Tier** | Employer type — Startup / MNC / PSU / Government; changes scoring |
| **Fresher mode** | Scores projects and certifications instead of penalising missing years |
| **Credit** | Unit of paid usage. Schema exists; **nothing consumes or grants credits** |
| **Golden test** | An input/expected-output fixture exported by an agent. **No runner executes them** |

---

## 35. Final status

Percentages would be fabricated, so status labels are used instead.

| Area | Status |
|---|---|
| Backend core (pipelines, agents, scoring) | **Advanced** — runs end to end, unverified by tests |
| Frontend analysis experience | **Advanced** — complete and responsive |
| Design system | **Near complete** |
| Authentication | **In progress** — email solid; Google inert; no recovery |
| Optimization experience | **Early** — backend done, UI is one button |
| Interview prep | **Early** — backend done, no UI |
| Credits & payments | **Not started** |
| Testing | **Not started** |
| Deployment & CI/CD | **Not started** |
| Observability | **Early** — telemetry rows written, cost reads 0, no monitoring |
| **Overall** | **Working prototype with a production-quality analysis experience, and no test, payment, or deployment infrastructure.** |

### The three things standing between this and a launch

1. **There are no tests.** `VerifyAgent` is the product's central promise and
   has no automated coverage of any kind.
2. **BE-2.** Until re-scoring runs on the user's accepted subset, the
   before/after screen reports a number about a resume the user did not accept —
   on the screen whose only job is proving the product worked.
3. **No deployment path and no version control.** There is no Dockerfile, no
   pipeline, and the directory is not a git repository.

None of these are research problems. All three are known, scoped, and small
relative to what already works.
