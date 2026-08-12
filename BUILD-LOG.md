# PARSE// — Build log

A complete record of one working session: what was asked, what was decided,
what was built, what broke, and what is still open.

Written to be picked up cold by someone who was not here.

**Document map**

| File | Owns |
|---|---|
| [`README.md`](README.md) | Original build status and correction log (pre-session) |
| [`PROJECT.md`](PROJECT.md) | Motive, scope, architecture, feature status |
| [`DESIGN-AND-ROADMAP.md`](DESIGN-AND-ROADMAP.md) | Audit, design system spec, screen specs, phases 0–14 |
| [`frontend/UX-CONTRACT.md`](frontend/UX-CONTRACT.md) | API field → UI element mapping, hard rules |
| **This file** | What actually happened, in order |

---

## 0. Session shape

Seven requests, in order:

1. Design the website UX flow and product experience → design deliverable
2. Run the application
3. Launch the flow: sign-in page, then dashboard
4. Write a project document (requirements → motive)
5. Produce the full design + implementation specification
6. Implement Phase 1 (design system)
7. Implement Phases 2, 3, 4

Phases were run one at a time, each ending in a verification pass and a report,
per the standing instruction not to auto-continue.

---

## 1. Documents produced

| Document | Location | Notes |
|---|---|---|
| UX architecture | Artifact + scratchpad HTML | 21 sections, wireframes rendered in Signal |
| UX contract | `frontend/UX-CONTRACT.md` | Implementation contract: routes, field map, hard rules |
| Project overview | `PROJECT.md` | 13 sections; also published as an artifact |
| Design & roadmap | `DESIGN-AND-ROADMAP.md` | Deliverables A–J; also published as an artifact |
| This build log | `BUILD-LOG.md` | — |

### Design decisions that departed from the brief

Each was flagged at the time, with the reason.

| Brief asked for | Delivered | Why |
|---|---|---|
| Interview Readiness as a headline score | **Portal score** (`score.naukri` + `gapReason`) | Nothing in the pipeline measures readiness. The portal gap is the India differentiator the brief describes and then never places. |
| Missing keywords show "+5 points" | Real value `maxPoints / totalJdSkills` | The old number came from a `PRIORITY_GAIN` constant whose own comment said "presentational only". |
| Dashboard: Applications, Interviews | Best match, Analyses, Optimised, Prep sets | No `Application` model; the product never observes an interview. |
| Six score categories | The backend's five, relabelled | UI-only relabel, no backend change. |
| "My Resumes" with version lineage | "My Scans" | `ResumeVersion` belongs to `Scan`; there is no `Resume` entity. |
| Primary `#4F46E5` | Kept `#3A2BD9` | Already shipping; 8.5:1 on white vs ~6.4:1; less like default framework indigo. |
| Sidebar navigation | Sidebar that auto-collapses to a rail on `/report/*` | Honours the brief while giving the analysis screen its width back. |

---

## 2. Getting it running

The app had never been run in this environment.

### Infrastructure

PARSE//'s own services were **not** running; every Docker container present
belonged to an unrelated project (TinyNinza), which also occupied ports 3000
and 5173.

```bash
docker start parse-postgres parse-redis      # existing, stopped — started, not recreated
docker exec parse-postgres psql -U postgres -d parse_dev \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

| Service | Port | Notes |
|---|---|---|
| Postgres + pgvector | **5434** | `parse-postgres`, schema already migrated (11 tables) |
| Redis | **6380** | `parse-redis` |
| Backend | **3001** | 3000 taken — `PORT=3001 npm run start:dev` |
| Frontend | **5188** | 5173/5174/5175 taken — `VITE_API_ORIGIN=http://localhost:3001 npx vite --port 5188 --strictPort` |

Only `GEMINI_API_KEY` is provisioned; `ANTHROPIC_API_KEY` and
`OPENAI_API_KEY` are empty, so `model-routing.ts` sends every agent to Gemini.

### First live run

`POST /scan` with a real backend-developer resume against a Razorpay JD:

- **HTTP 201 in ~30 seconds**
- Parsed both documents, scored **43 generic / 48 Naukri**
- 7 missing keywords, 6 weak bullets, 4 roadmap items
- Report screen rendered it with no app-level console errors

This is the first end-to-end proof the pipeline works against real input —
the README had only ever claimed a typecheck.

### Browser driving

`chromium-cli` is unavailable here. Installed `playwright-core` into the
scratchpad and drove the Playwright-cached Chromium directly
(`~/Library/Caches/ms-playwright/chromium-1234/...`). All verification below
was run that way.

---

## 3. Backend changes

**One change only. The AI orchestration was not touched.**

### BE-1 — scan ownership

| File | Change |
|---|---|
| `backend/src/auth/optional-jwt.guard.ts` | **New.** `OptionalJwtGuard` (attaches user, never rejects) + `JwtAuthGuard` + `userIdOf()` |
| `backend/src/scan/scan.controller.ts` | `POST /scan` uses the optional guard and passes `userId`; **new** `GET /scans` behind a real guard; `GET /scan/:id` left unguarded so report links stay shareable |
| `backend/src/scan/scan.service.ts` | **New** `listScans()` returning a projection; **new** `attributeCachedScan()` |
| `backend/src/scan/scan.module.ts` | Imports `PassportModule` so the guards resolve the `jwt` strategy |

`listScans()` returns a **summary projection**, not whole rows — 25 full scans
would ship 25 resumes and 25 job descriptions to render a few cards.

### The cache/ownership bug this exposed

Adding ownership broke the cache path in a way that only appeared when tested:

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

---

## 4. Phase 1 — Design system

Foundations only; no page redesign.

**Dependencies added:** `lucide-react`, `@fontsource/ibm-plex-sans`,
`@fontsource/ibm-plex-mono`.

### The font fix

`signal/tokens.js:30` fetched IBM Plex from Google Fonts **at runtime**. That
host is unreachable from this machine, so the app had been silently falling
back to system fonts with no visible signal. Replaced with Fontsource: 154
woff2 files ship in `node_modules` and Vite bundles them.

Verified: `document.fonts.check()` true for both families, and **zero external
network requests** from the running page.

### Files

```
design-system/
  tokens.css     colour · type scale (12 roles) · spacing 4→96 · radius ·
                 shadow · motion · z-index · focus; contextual spacing
                 shifts at breakpoints
  base.css       reset · focus-visible · type utilities · reduced-motion
  index.css      single stylesheet entry (fonts + tokens + base + components)
  tokens.js      JS mirror: scoreColor / scoreTone / scoreLabel / breakpoints
  index.js       barrel — components import from here, never from files
  components/    Button · Field(Input/Textarea/Select/Checkbox/Radio/
                 ChoiceGroup) · Card/Divider · Chip/KeywordChip ·
                 Badge/SourceBadge/PriorityBadge/VerificationBadge/
                 ConfidenceMark/LockedBlock · Tabs · Skeleton ·
                 Alert/EmptyState/ErrorState · Toast · Modal · Icon
pages/DesignSystemPreview.jsx    kitchen sink at /design-system
```

Three components encode product rules rather than styling: `SourceBadge`
(LOCAL/MODEL), `ConfidenceMark` (bars **and** the word, so it survives a
screenshot and a screen reader), and `VerificationBadge` — which keeps
*"verify this"* and *"not published"* as separate states, the distinction the
optimize flow depends on.

### Verified
Build clean · fonts loaded · **no external requests** · tabs arrow-key nav ·
locked tab not selectable · modal focus trap + Escape · toast polite vs
assertive routing · no overflow-x at 1440/834/390 · report and sign-in
regression clean.

---

## 5. Phase 2 — Application shell

### Files
```
layouts/AppShell.jsx + .css      sidebar + top bar + content; bottom nav on phones
layouts/PublicShell.jsx          landing, auth, anonymous report
design-system/components/        Sidebar · TopBar · BottomNav · Navigation.css
design-system/components/Page.jsx + .css    Page · Section · Grid · Split
components/ErrorBoundary.jsx     per-route, stack in dev only
hooks/useMediaQuery.js           useIsMobile / useIsCompact
```

`Page` carries the measure — `narrow` 560 / `default` 940 / `wide` 1200 —
which is where the hardcoded 480px cap goes to die.

### Behaviours
- Sidebar 240px ↔ 64px rail, persisted; **forced to the rail on `/report/*`**,
  restored on leaving
- Bottom nav is *rendered* only below 768, not CSS-hidden, so it is not
  duplicated in the accessibility tree
- Anonymous report gets public chrome, so WhatsApp deep links work
- Three nav items disabled with "Soon" rather than inventing destinations

### Bugs found and fixed
1. **Skip link unreachable.** React StrictMode double-invokes effects in dev,
   so a first-render ref guard was already `false` on the second run and focus
   jumped into main on load. Fixed by comparing pathnames — idempotent under
   double-invocation.
2. **Dead control.** The collapse toggle rendered on report routes where the
   rail is forced and clicking did nothing. Removed via `canToggle`.
3. **Wordmark clipped to "PARS"** on mobile — a long email squeezed it. Brand
   no longer shrinks; email dropped below 768.
4. **Two wordmarks on `/app/analyze`** once the screen was wrapped in the shell.

---

## 6. Phase 3 — Core flow

### Files
```
pages/Landing.jsx + .css              hero carries a real report fragment
pages/Onboarding.jsx                  3 questions, all skippable
features/analysis/AnalyzePage.jsx     two-column, drag-drop, client-side PDF
features/analysis/ProcessingState.jsx honest staged progress
contexts/AuthContext.jsx              single source for session
services/analytics.js                 EVENTS map + track(); dev-only for now
api/client.js                         rewritten: refresh-on-401, prefs, ApiError
screens/Dashboard.jsx + .css          rebuilt on GET /scans
screens/UploadScreen.jsx              deleted (replaced by AnalyzePage)
```

### Notable
- **Refresh-on-401** shares one in-flight promise; without it three concurrent
  requests would rotate the refresh token three times and kill the session.
- **Intended-destination redirect**: the auth wall carries `from`, so signing in
  returns you to the page you wanted.
- **Processing is honest.** The pipeline has three waves and `POST /scan` does
  not return until all finish, so there is no stream to drive seven ticking
  steps. The three "done" rows are things genuinely known before the request
  goes out (PDF parsed in-browser, JD read from the form, local checks are
  free); only the elapsed counter moves. Faking progress on the one screen
  asking the user to wait and trust it would be self-defeating.
- **Onboarding answers live in `localStorage`** — `User` has no experience or
  tier column, so there is nowhere on the server to put them. They pre-fill the
  analyse form; the values that matter are sent per scan as `ScanOptions`.

### Bugs found and fixed
1. **Cache hit vs ownership** (see §3) — found by testing, not by reading.
2. **The paste box unmounted while you typed into it.** Its render condition
   included `!resumeText`, so it vanished on the first character.
3. Empty state read "Analyse your **first** job" above a button saying
   "Analyse **new** job".

### Verified
Landing → signup → onboarding → dashboard → analyze → processing → report →
dashboard-lists-it, plus auth wall → return to intended page. No console
errors; no overflow at any breakpoint.

---

## 7. Phase 4 — Analysis experience

The P0 screen. `screens/ATSScanReport.jsx` (624 lines of inline-styled
prototype) was replaced.

### Files
```
features/analysis/ReportPage.jsx     route · tabs · loading/error/failed states
features/analysis/reportData.js      the seam: mapScanToReport()
features/analysis/Report.css
features/analysis/panels/            Overview · Score · Keywords · Quality · Fixes
design-system/components/ScoreRing.jsx + .css   ScoreRing + ProgressBar
```

### What changed
- **Width: 480px → 1200px.** The audit's headline finding is closed.
- **Opens on Overview**, not Score.
- Six panels, one fetch, tab in the URL hash.
- Mobile drops tabs entirely: Overview, then accordions.
- Rings carry their meaning in the accessible name —
  *"Match: 43 out of 100, Weak match"* — not in colour alone.

### The three audit bugs
| # | Was | Now |
|---|---|---|
| 1 | Naukri gap panel hardcoded to critical red; a *higher* portal score rendered as a problem | Tone follows the sign — this scan shows `+5 stronger on Naukri` in **green** |
| 2 | Tier rendered `Mnc` / `Psu` | `MNC`, via an explicit label map |
| 3 | `PRIORITY_GAIN` fabricated per-keyword points | `maxPoints / totalJdSkills`, `maxPoints` read from the payload's own category → **+3.0, badged LOCAL** |

### The keyword-impact derivation

```
exactMatchPct = found / totalJdSkills × 100      (DeterministicCheckAgent)
keywordEarned = exactMatchPct / 100 × maxPoints  (ScoreAggregator)
⇒ one keyword  = maxPoints / totalJdSkills
```

30 / 10 = **+3.0**, which the score panel independently corroborates
("3 of 10 → 9/30"). It is the *direct* gain only; the roadmap's larger,
model-estimated `gain` covers knock-on effects and is badged MODEL. The two
are shown as separate, differently-badged numbers on purpose.

### Also fixed
Keyword terms rendered lowercase (`docker`, `rest apis`) because the backend
normalises them. Display casing is recovered from the parsed JD's own strings:
**Docker, REST APIs, Apache Kafka, Node.js, TypeScript**.

### Preserved
The client-side score simulator (FR-19) and the rewrite endpoint including its
fail-closed branch. The simulator now projects onto **Match**, not Naukri —
the roadmap's gains are derived from the generic score, so the prototype's
choice was an artifact.

---

## 8. Every bug found, in one place

| # | Bug | Location | Found by | Status |
|---|---|---|---|---|
| 1 | Naukri gap hardcoded critical red | `ATSScanReport.jsx:160` | Running the app | Fixed (P4) |
| 2 | Tier renders `Mnc`/`Psu` | `ATSScanReport.jsx:42` | Running the app | Fixed (P4) |
| 3 | Fabricated per-keyword points | `ATSScanReport.jsx:16` | Reading the code | Fixed (P4) |
| 4 | Fonts fetched from a CDN, failing silently | `signal/tokens.js:30` | Console check | Fixed (P1) |
| 5 | Skip link unreachable under StrictMode | `AppShell.jsx` | Keyboard test | Fixed (P2) |
| 6 | Collapse toggle dead on report routes | `Sidebar.jsx` | Shell test | Fixed (P2) |
| 7 | Wordmark clipped on mobile | `Navigation.css` | Screenshot | Fixed (P2) |
| 8 | Duplicate wordmark on `/app/analyze` | `UploadScreen.jsx` | Screenshot | Fixed (P2) |
| 9 | **Cache hit returned another user's scan row** | `scan.service.ts` | API test | Fixed (P3) |
| 10 | Paste box unmounted while typing | `AnalyzePage.jsx` | E2E test | Fixed (P3) |
| 11 | "first job" / "new job" copy mismatch | `Dashboard.jsx` | E2E test | Fixed (P3) |
| 12 | Keyword terms rendered lowercase | `reportData.js` | Screenshot | Fixed (P4) |

Nine of twelve were found by **running** the thing, not by reading it.

---

## 9. Current state

### Routes
| Route | Screen | Shell |
|---|---|---|
| `/` | Landing | Public |
| `/login` | Sign in / sign up | Public |
| `/app` | Dashboard | App |
| `/app/onboarding` | Onboarding | App |
| `/app/analyze` | Analyse + processing | App |
| `/report/:scanId` | Report — 6 panels | App if signed in, else Public |
| `/design-system` | Component reference | None |

### API
```
POST /auth/register · /auth/login · /auth/refresh
GET  /auth/google · /auth/google/callback        (inert without credentials)
POST /scan                 optional auth — anonymous scans still work
GET  /scans                auth required — user's scans, projected      ← new
GET  /scan/:id             unguarded — shareable report links
POST /scan/:id/rewrite
GET  /scan/:id/diff · /scan/:id/interview-prep
```

### Verification status
Every phase ended green: production build clean, no console errors, no
horizontal overflow at 1440 / 1024 / 834 / 390, and a regression pass over the
previously working screens.

---

## 10. Still open

### Blocking a real launch
1. **No tests exist.** `npm test` runs jest against zero test files. Fifteen
   agents export `goldenTests` arrays that nothing executes. `VerifyAgent` —
   the fail-closed hallucination guard the whole product claim rests on — has
   no automated coverage.
2. **No real-user validation.** Phase 1's actual exit criterion, untouched.
3. **Credit gating inert.** Ledger tables exist; nothing writes to them.

### Backend work the UX needs
| # | Change | Blocks |
|---|---|---|
| BE-2 | `POST /scan/:id/rescan` over the existing `runFromStructured()` | An honest after-score when the user rejects changes |
| BE-3 | `Scan.stage` between waves | The full staged processing screen |
| BE-4 | Persist accept/reject decisions | Resuming an interrupted review |
| BE-5 | `Resume` entity | Resume library with cross-job lineage |
| BE-6 | Decouple `InterviewPrepSet` from rewrite | Prep without paying for a rewrite |
| BE-7/8 | Credits, Razorpay | Monetisation |
| BE-9 | Expose `recruiterComments` | Free win — already generated, discarded |
| BE-10 | Real `RATE_CARD` values | Cost telemetry currently computes **zero** |
| BE-11 | Analytics endpoint | Funnel measurement |

**BE-2 is the one that matters.** Without it the product prints a headline
number describing a resume the user did not accept, on the screen whose only
job is proving the product worked.

### Smaller
- `/forgot-password` not built — no backend endpoint; a form that goes nowhere
  is worse than none
- `index.html` declares no favicon (a 404 on every page load)
- `signal/tokens.js` + `signal/ui.jsx` remain for `SignIn`; they retire with it
- Onboarding answers cannot persist server-side (no profile columns)

### Environment quirks
- Outbound network here is **flaky**: `fonts.googleapis.com` and
  `registry.npmjs.org` were unreachable at points, and one live scan failed
  with `fetch failed` from the Gemini SDK. The backend correctly marked that
  scan `FAILED`. Later verification used already-cached inputs.
- `RewriteAgent` / `VerifyAgent` currently run on a flash-class Gemini model,
  not a dedicated reasoning tier — worth revisiting before launch.

---

## 11. Next

**Phase 5 — Optimization:** diff view, per-change accept / reject / edit, the
two distinct verification warnings, and before/after. Needs **BE-2** to show a
truthful after-score.

Phases 6–14 are specified in [`DESIGN-AND-ROADMAP.md`](DESIGN-AND-ROADMAP.md) §F.
