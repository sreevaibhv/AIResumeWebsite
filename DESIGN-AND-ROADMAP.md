# PARSE// — Design System, Screen Specs & Implementation Roadmap

Deliverables A–J. Produced from an audit of the working repository, not from
assumptions. Nothing here has been implemented yet.

**Related documents — read these first, they are not repeated here:**

| Document | Owns |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Motive, scope, architecture, build status |
| [`frontend/UX-CONTRACT.md`](frontend/UX-CONTRACT.md) | API field → UI element mapping, hard rules |
| This document | Audit, design system, screen specs, phased roadmap |

---

# A. Current state audit

## A.1 The headline finding

**The desktop experience does not exist.**

`ATSScanReport.jsx:573` caps the most important screen in the product at
`maxWidth: 480`. `UploadScreen.jsx:93` does the same. There are **zero media
queries** in any screen — the only `@media` rule in the codebase is the
reduced-motion guard in `tokens.js:34`.

The app is not "responsive but unpolished". It is a **single phone-width
column centred in a 1440px viewport**, with roughly 1000px of empty space on
either side. Every desktop requirement in the brief — multi-column analysis,
side-by-side diffs, comparison views — has nowhere to render today.

This reframes the work. It is not a responsive pass over an existing desktop
UI; **the desktop UI has to be designed and built**, with the current narrow
column becoming the mobile breakpoint it already effectively is.

## A.2 Classified inventory

### Already working — do not touch

| Area | Evidence |
|---|---|
| Scan pipeline, 3 waves, 7 model calls | Live run: HTTP 201 in ~30s, coherent output |
| Score aggregation with provenance | 5 categories, `earned`/`max`/`reason`/`source` |
| Fail-closed rewrite verification | `RewritePipeline` returns original + flagged claims |
| Automatic re-score after rewrite | `rescored.score` in the diff payload |
| Redis caching keyed on options | `sha256(resume+jd+tier+fresherMode)` |
| Email auth, JWT + refresh rotation | Driven end to end in a browser |
| Client-side PDF extraction | pdf.js; unreadable PDFs caught before any request |
| `Signal` colour + type tokens | `tokens.js` — genuinely good, keep |
| `LOCAL` / `MODEL` provenance badge | `<Source>` in the report |

### Already designed, not built

Landing, onboarding, optimize/verify, before-after, interview prep, scan
library, version history, settings — all specified in `UX-CONTRACT.md`, none
implemented.

### Partially implemented

| Item | Gap |
|---|---|
| Design system | Colour and type only. **No spacing, radius, shadow, breakpoint, or z-index scale.** |
| Report screen | 4 of 6 panels (Score, Keywords, Quality, Fixes). No Overview, no Prep. |
| Dashboard | Built this session. Scan list reads `localStorage`, not the server. |
| Auth | Email works. Google SSO wired but inert. No forgot-password, no refresh-on-401. |
| Component library | 8 primitives in `signal/ui.jsx`. The brief asks for ~27. |

### Missing entirely

Responsive layout · app shell / sidebar · icon library · state management ·
toasts · modals · skeletons · error boundaries · analytics · **all tests** ·
credit gating · payments · WhatsApp.

### Needs redesign

| Item | Why |
|---|---|
| **All layout** | 480px cap, no breakpoints — see A.1 |
| **Styling approach** | ~155 inline `style={{}}` objects across screens. No variants, no reuse, no way to change spacing globally. |
| **Report information hierarchy** | Opens on a *Score* tab. Should open on *Overview*: verdict → strengths → problems → fixes → CTA. |
| **Typography delivery** | `tokens.js:30` fetches IBM Plex from Google Fonts at runtime. Unreachable in testing → silent fallback to system fonts. Must self-host. |

### Needs bug fix

| # | Bug | Location |
|---|---|---|
| 1 | Naukri gap panel hardcoded to critical red; a *higher* portal score renders as a problem | `ATSScanReport.jsx:160` |
| 2 | Tier renders `Mnc` / `Psu` | `ATSScanReport.jsx:42` |
| 3 | Fabricated per-keyword point values — see D.7 for the real fix | `ATSScanReport.jsx:16` |
| 4 | Fonts fail silently | `tokens.js:30` |

### Needs product decision

| # | Decision | Detail |
|---|---|---|
| 1 | **Interview Readiness score** | The brief puts it on the dashboard. Nothing measures it. Options in E.4. |
| 2 | **Applications / Interviews counters** | No `Application` model; the product never observes an interview. |
| 3 | **Score category labels** | The brief's six (Skills/Experience/Keywords/Projects/Education/Formatting) do not match the backend's five. Resolution in D.6. |
| 4 | **Government tier** | Still scoped to structural guidance only. |
| 5 | **Sidebar vs full-width report** | Brief specifies a sidebar; the report needs width. Resolution in D.9. |

---

# B. Sitemap

```
PUBLIC
  /                        Landing
  /how-it-works            Workflow explainer
  /pricing                 Plans
  /login  /signup          Auth
  /forgot-password         Recovery
  /report/:scanId          Report — link-shareable, WhatsApp deep-link target

APP  (authenticated shell)
  /app                     Dashboard
  /app/onboarding          3 questions, skippable
  /app/analyze             New analysis
  /app/analyze/:id/running Processing
  /app/resumes             Resume library
  /app/resumes/:id         Resume detail + versions
  /app/prep                Interview prep index
  /app/settings            Account · plan · privacy

SCAN-SCOPED
  /report/:scanId                    Overview · Score · Keywords · Quality · Fixes · Prep
  /report/:scanId/optimize           Review AI changes
  /report/:scanId/result             Before / after
  /report/:scanId/prep               Interview prep
```

Sidebar navigation is five items, matching the brief: **Dashboard · Analyze ·
My Resumes · Interview Prep · Settings**.

---

# C. User flows

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

# D. Design system

Extends `Signal`. Everything below belongs in `frontend/src/design-system/`
as tokens — no hardcoded values in components.

## D.1 Colour

Keep the established primary. The brief suggests `#4F46E5`; the existing
`#3A2BD9` is deeper, already shipping, and scores **8.5:1 on white** (AAA)
versus ~6.4:1 for `#4F46E5`. It also reads less like default framework indigo,
which serves the "not generic AI SaaS" requirement.

```
PRIMARY
  --accent            #3A2BD9    actions, links, active nav
  --accent-hover      #2E21B0
  --accent-wash       #EEECFC    selected rows, info blocks
  --accent-on         #FFFFFF    text on accent

SURFACES
  --paper             #F7F8F9    page background
  --surface           #FFFFFF    cards
  --surface-2         #FBFCFD    table headers, insets
  --rule              #E2E6EA    borders
  --rule-soft         #EDF0F2    dividers, tracks

TEXT
  --ink               #0E1116    primary
  --ink-mid           #3D4650    secondary
  --ink-mute          #79838F    muted, captions
  --ink-disabled      #AEB6BE

SEMANTIC                          wash
  --good              #12735A    #E9F4F1   strong match, verified, gains
  --warn              #B07103    #FCF4E6   partial, verify-this, medium
  --critical          #C4382A    #FBEDEB   missing must-have, failed verify
```

**Rules**

- Semantic colour encodes meaning, never decoration.
- Never colour alone: every state pairs colour with an icon or a text label
  (WCAG 1.4.1, and ~8% of male users are red/green colour-blind).
- `scoreColor()` thresholds stay as they are: `<55` critical, `<75` warn,
  else good.
- **No dark mode in v1.** Light-first is the stated direction; a second theme
  doubles the surface area before the first one is finished.

## D.2 Typography

Self-host IBM Plex as woff2 in `public/fonts/` with `@font-face` and
`font-display: swap`. **Delete the Google Fonts `@import`** — it fails
silently and there is no visible signal when it does.

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
| Score sm | **Mono** | 18 / 1 | 600 | −0.02em |
| Score md | **Mono** | 30 / 1 | 600 | −0.02em |
| Score XL | **Mono** | 56 / 1 | 600 | −0.03em |

**Mono is the instrument.** Every number, label, chip, badge and score uses
it; prose uses sans. This is what makes the product read as an analysis tool
rather than a content generator.

All numeric columns get `font-variant-numeric: tabular-nums`.

## D.3 Spacing

Single scale. No arbitrary margins.

```
--s-1  4      --s-4  16     --s-7  48
--s-2  8      --s-5  24     --s-8  64
--s-3  12     --s-6  32     --s-9  96
```

| Context | Value |
|---|---|
| Page padding — desktop / tablet / mobile | 32 / 24 / 16 |
| Card padding — default / compact | 16 / 12 |
| Section gap | 32 |
| Grid gutter | 24 desktop, 16 mobile |
| Form field gap | 14 |
| Inline chip gap | 6 |

Lay out with flex/grid `gap`, never per-child margins.

## D.4 Radius, shadow, motion

```
--r-sm   6    chips, badges, inputs, buttons
--r-md   8    small cards
--r-lg  12    cards, panels
--r-xl  16    modals, drawers

--shadow-sm  0 1px 2px rgba(14,17,22,.05)     cards (rarely needed)
--shadow-md  0 4px 12px rgba(14,17,22,.08)    dropdowns, popovers
--shadow-lg  0 12px 32px rgba(14,17,22,.12)   modals only
```

Hierarchy comes from **borders and background tone**, not floating shadows.

```
--t-fast    120ms ease-out    hover, focus
--t-base    200ms ease-out    expand, tab change
--t-slow    400ms ease-out    score count-up, before/after
```

All of it inside `@media (prefers-reduced-motion: reduce)` guards — already
present in `tokens.js` and must be preserved.

## D.5 Breakpoints

```
--bp-sm   640    phone → large phone
--bp-md   768    tablet
--bp-lg  1024    laptop — sidebar appears
--bp-xl  1280    desktop — full two-column analysis
```

| Range | Shell | Report |
|---|---|---|
| < 768 | Bottom nav, no sidebar | Single scroll, no tabs, sticky CTA |
| 768–1023 | Icon rail | Tabs, single column |
| 1024–1279 | Full sidebar, collapsible | Tabs, two columns |
| ≥ 1280 | Full sidebar | Two columns + persistent score header |

## D.6 Score categories — resolved

The brief's six categories do not match the backend's five. The backend is the
truth; this is a **relabel only, no backend change**:

| Backend `key` | Weight | UI label |
|---|---|---|
| `Keyword coverage` | 30 | Skills & keywords |
| `Experience fit` | 20 | Experience |
| `Bullet quality` | 20 | Impact & achievements |
| `Structure` | 15 | Sections & projects |
| `Contact & format` | 15 | Formatting & contact |

Points earned is `earned`; points lost is `max − earned`. Both come from the
same object, so the "earned vs lost" split the brief asks for needs no new
data.

## D.7 Per-keyword impact — a real number, not a guess

The brief (§24) asks each missing keyword to show an estimated score impact.
The current code fabricates this from a `PRIORITY_GAIN` constant whose own
comment admits it is "presentational only".

**It does not need to be fabricated.** From `deterministic-check.agent.ts`:

```
exactMatchPct = found / totalJdSkills × 100
keywordEarned = exactMatchPct / 100 × 30
```

so each keyword is worth exactly:

```
impact = 30 / totalJdSkills          ← deterministic, reproducible
```

On the live scan — 10 JD skills — that is **+3.0 points per keyword**, and the
report's own "3 of 10 keywords present → 9/30" confirms it.

Present it as two honest tiers:

- **Keyword panel** — `+3.0` badged `LOCAL`. The guaranteed direct gain.
- **Roadmap item** — the model's `gain`, badged `MODEL` with its `conf`.
  Usually higher, because adding Docker also improves semantic match and
  bullet quality.

This satisfies the brief's requirement *and* the product's core promise.
Delete `PRIORITY_GAIN`.

## D.8 Iconography

**Lucide React.** 1.5px stroke, sizes 14/16/20/24 only, `currentColor`.
Consistent stroke weight, tree-shakeable, no runtime cost.

Icons support scanning; they never replace a label. **No emoji in the UI** —
the padlock and status marks in the current mockups become
`Lock`, `Check`, `X`, `AlertTriangle`.

Semantic set: `Check` good · `AlertTriangle` warn · `XCircle` critical ·
`Lock` gated · `Info` explanation · `ArrowRight` progression.

## D.9 App shell — sidebar, resolved

The brief specifies a sidebar; the report needs horizontal room. Both are
satisfiable:

- Sidebar is **240px expanded, 64px icon rail collapsed**.
- It **auto-collapses on `/report/*` routes**, where content width is worth
  more than persistent labels.
- The user can toggle it, and the choice persists.
- Below 768px it becomes bottom navigation.

```
≥1024, app routes            ≥1024, report routes
┌──────┬──────────────┐      ┌──┬─────────────────────┐
│ 240  │              │      │64│                     │
│ nav  │   content    │      │▪ │   report, wide      │
└──────┴──────────────┘      └──┴─────────────────────┘
```

## D.10 Component library

Build as variants, not per-page copies. `[E]` exists, `[U]` needs upgrading,
`[N]` new.

| Group | Components |
|---|---|
| Primitives | `Button` [U] (primary/secondary/ghost/danger × sm/md/lg, loading, icon) · `Input` [U] · `Textarea` [N] · `Select` [N] · `Checkbox` [N] · `Radio` [N] · `Label` [E] |
| Layout | `AppShell` [N] · `Sidebar` [N] · `TopBar` [N] · `BottomNav` [N] · `Page` [N] · `Card` [E] · `Divider` [N] |
| Data display | `ScoreRing` [E] · `ScoreCard` [N] · `MetricCard` [N] · `ProgressBar` [N] · `Chip` [E] · `PriorityBadge` [N] · `SourceBadge` [E] · `VerificationBadge` [N] · `ConfidenceMark` [N] · `Table` [N] |
| Navigation | `Tabs` [U] (scrollable on mobile) · `Breadcrumb` [N] · `LoopIndicator` [N] |
| Feedback | `Alert` [N] · `Toast` [N] · `Skeleton` [N] · `EmptyState` [N] · `ErrorState` [N] · `Tooltip` [N] |
| Overlay | `Modal` [N] · `Drawer` [N] · `Dropdown` [N] |
| Domain | `FileUpload` [U] · `ComparisonView` [N] · `KeywordChip` [N] · `BulletCard` [N] · `QuestionCard` [N] · `LockedBlock` [N] |

## D.11 Frontend architecture

```
src/
  design-system/   tokens.ts, primitives, one component per file
  components/      shared composites
  features/
    analysis/      components, hooks, api
    optimization/
    interview-prep/
    resumes/
    auth/
  layouts/         AppShell, PublicShell
  pages/           route components — composition only, no business logic
  hooks/           useScan, useAuth, useMediaQuery
  services/        api client, analytics
  utils/
  types/
```

**State:** React Query (or SWR) for all server state — it removes the manual
loading/error/refetch handling currently written by hand in every screen. One
`AuthContext` for session. No global store; there is no client state that
justifies one.

**Rule:** page components compose features. Business logic lives in hooks.

---

# E. Screen specifications

Every screen specifies purpose, layout, CTA, and its four states. Wireframes
for the analysis screens are in `UX-CONTRACT.md`.

## E.1 Landing `/`

**Purpose** — get a resume and a JD into the box.
**Layout** — hero with the actual first input, not a picture of one. Then, in
order: product preview (annotated real report) · how it works · ATS
intelligence · Naukri gap *(the section a competitor cannot copy — give it the
illustration budget)* · verified rewriting · interview prep · before/after ·
trust & privacy · pricing · FAQ · final CTA · footer.
**CTA** — primary `Analyse my resume`; secondary `See how it works`.
**Responsive** — single column below 768; hero inputs stack.
**States** — Loading: none. Empty: n/a. Error: inline on the hero input.
Success: navigates to processing.

> **Copy rule for the whole marketing surface:** never promise a score gain, an
> interview, or a percentage improvement. The honest and stronger claim is
> diagnostic: *"See exactly which requirements you miss, and what it costs you."*

## E.2 Auth `/login` `/signup` `/forgot-password`

**Purpose** — minimum friction; never the star of the screen.
**Layout** — single 380px card. Contextual heading: arriving from a finished
scan reads *"Save your analysis"*.
**CTA** — `Create account` / `Sign in`; Google secondary.
**States** — Loading: button spinner, form disabled. Error: inline above the
button, mapped to human copy (`friendly()` in `SignIn.jsx`). Success: redirect
to intended destination.
**Note** — needs a 401 interceptor that refreshes the token once before
bouncing to `/login`. Not built.

## E.3 Onboarding `/app/onboarding`

**Purpose** — capture the two answers that change scoring.
**Layout** — one screen, three questions: experience (required), target tier
(required), target role (optional). Both required answers map to
`ScanOptions.fresherMode` and `tier`.
**CTA** — `Continue`; `Skip` always available.
**States** — Error: inline. Success: dashboard.

## E.4 Dashboard `/app`

**Purpose** — answer *"what do I do next?"* before any statistic.

**Layout**
1. Greeting
2. **Next-step band** — the most recent scan with unaddressed fixes, and a
   direct CTA. Never empty: with nothing pending it becomes *"Analyse a new
   job"*.
3. Metric row
4. Recent analyses
5. Usage / credits

**Metrics — resolved.** Of the brief's four, only one has a data source:

| Brief asks | v1 shows | Why |
|---|---|---|
| Resume Health | **Best match** — `max(score.generic)` | Real |
| Interview Readiness | **Prep sets ready** + question count | No readiness measure exists (see below) |
| Applications | **Analyses run** | No `Application` model |
| Interviews | **Optimized** — verified rewrites | Product never observes an interview |

*Interview Readiness* can become real in Phase 6 as **gap coverage**: the
fraction of weak areas from the roadmap for which the user has marked a
question prepared. That needs per-question progress tracking (P2). Until then
it is a state, not a number — inventing it would contradict the product's
central claim.

**States** — Loading: 3 skeleton rows. Empty: *"Analyse your first job"* +
CTA (built). Error: inline card, retry.

## E.5 Analyze `/app/analyze`

**Purpose** — four inputs, one screen, no wizard.
**Layout** — two columns ≥900px (resume | JD), tier and experience below as
chip groups. Returning users see them collapsed as *"MNC · Fresher — change"*;
never hidden, since they are the India differentiators.
**CTA** — `Analyse my resume`, with cost and duration beside it.
**States** — Loading: parse progress on the file card. Empty: dropzone.
Error: unreadable PDF → reveal a paste textarea inline; JD < 200 chars →
"That looks like a job title, not a description." Success: → processing.

## E.6 Processing `/app/analyze/:id/running`

**Purpose** — hold attention honestly for ~30 seconds.
**Layout** — staged checklist. The first three lines are genuinely known
(client-side parse, JD parse, local deterministic checks are free and
instant); the rest reflect real wave boundaries.
**Do not show** model names, agent names, call counts, or token spend.
**States** — Error: pipeline failure → "Your resume is safe and your credit
has not been used." Success: → report.
**Depends on** backend change BE-3; until then ship the 3-stage version.

## E.7 Report `/report/:scanId` — the most important screen

**Purpose** — score, evidence, and one obvious next action.
**Layout** — six panels, one fetch, tab in the URL hash. **Default tab becomes
Overview**, not Score.

```
Overview   verdict · 3 rings · what's working · what's hurting · fix first · CTA
Score      5 categories, earned/lost/reason/provenance
Keywords   exact vs semantic · requirement ledger · found · missing · overused
Quality    section scores · weak bullets
Fixes      full roadmap, gated after 3
Prep       locked — "Unlocks after you optimize"
```

**Above the fold** — role and company, three rings (Match · Portal · Quality),
a one-sentence verdict.
**CTA** — `Fix my resume`.
**Responsive** — ≥1024 two columns, score header persists on scroll. <768 no
tabs: score → problems → fixes → sticky CTA, details as accordions.
**States** — Loading: skeleton preserving ring positions. Empty: n/a.
Error: 404 → "That analysis link has expired." Success: is the screen.

## E.8 Optimize `/report/:scanId/optimize`

**Purpose** — never let AI change a resume silently.
**Layout** — one change at a time. Original | Improved side by side ≥1024,
stacked below. Beneath: *why this changed*. Actions: `Accept` · `Keep
original` · `Edit`. Progress counter in the header.

**Two distinct warnings, never conflated:**

| | Trigger | Treatment |
|---|---|---|
| **Verify this claim** | The rewrite introduces a number or claim absent from the original — *shown even when verification passed*, because "traceable" is weaker than "true" | Amber block, three responses: accurate / edit / remove |
| **We did not publish this** | `status: "verification_failed"` | Red, full screen, original intact, credit unspent |

**States** — Loading: rewriting → checking every claim → re-scoring. Error:
the failure screen above, which is a **trust asset, not an embarrassment** —
most competitors would have silently shipped the fabricated claim.

## E.9 Result `/report/:scanId/result`

**Purpose** — make the value obvious.
**Layout** — Before → After with the delta as the largest element; then
per-category movement.
**CTA** — `Prepare for the interview`; secondary `Download resume`.
**Caveat** — until backend change **BE-2** lands, the caption must read
*"re-scored on all suggested changes"*, and rejecting a change must visibly
invalidate the after-score rather than silently keeping it.

## E.10 Interview prep `/report/:scanId/prep`

**Purpose** — prepare for *this* interview, from *these* gaps.
**Layout** — weak areas first, then questions grouped by weak area, with
Technical/HR as a secondary filter. Every question shows its `why`, never
collapsed — that field is what separates this from a question bank.
**Note** — the backend returns `technical[]` and `hr[]` only. Grouping by weak
area needs no new agent output; the brief's six categories do not exist.
**States** — Empty: "Optimize a resume first." Locked: *"Unlocks after you
optimize"*, not a generic padlock — prep is gated by the data model, not by
payment.

## E.11 Resume library `/app/resumes`

**Purpose** — see every resume and its best result.
**Blocked by** the schema: `ResumeVersion` belongs to `Scan`, and there is no
`Resume` entity. Until **BE-5**, ship **My Scans** grouped by loop stage
(In progress · Optimized · Not started) — which is also the truer model of a
job hunt.
**Actions** — Open · Re-analyse · Rename · Duplicate · Delete.

## E.12 Version history `/app/resumes/:id`

**Layout** — linear: Original → Current, with the change count between them
and a `Compare` action. Rejected rewrites appear as a note, not a version —
they were never saved. No branching tree in v1.

## E.13 Settings `/app/settings`

Account · plan and credits · **privacy**: what is stored, delete a resume,
delete the account. State plainly what happens to the data; make no
unsupported security claims.

## E.14 Global states

**Loading** — skeletons that preserve final layout; never a full-page spinner
except the first authenticated paint. Buttons keep their size and swap the
label for a spinner.

**Empty** — every one names the object that would fill it and offers the
action that creates it. No shrugs.

**Error** — every message answers three questions: what happened · what
happened to my data and my money · what do I do now.

| Condition | Message |
|---|---|
| Scanned-image PDF | "We could not find any text in that PDF — it looks like a scan. Paste your resume text instead." |
| Unsupported file | "We can read PDF, DOCX and TXT." |
| JD too short | "That looks like a job title, not a description." |
| Pipeline failed | "We could not finish the analysis. Your resume is safe and your credit has not been used." |
| Verification failed | Dedicated screen — E.8 |
| Rate limited | "You have used all N analyses this month. They reset on <date>." |
| Payment failed | "That payment did not go through — your bank may have declined it. Nothing was charged." |
| Session expired | Silent refresh; on failure, return to the same page after login |
| Unauthorized | "This analysis belongs to another account." |
| Offline | "You are offline. Your inputs are saved on this device." |

---

# F. Implementation roadmap

Priorities: **P0** core · **P1** launch · **P2** post-launch · **P3** later.

| Phase | Scope | Priority | Depends on |
|---|---|---|---|
| **0 — Audit** | This document | — | done |
| **1 — Design system** | Self-hosted fonts · full token set · Lucide · Button/Input/Card/Chip/Badge/Tabs/Skeleton/Alert/Toast/Modal · folder restructure · React Query | **P0** | — |
| **2 — App shell** | Sidebar (collapsible, auto-collapse on report) · top bar · bottom nav · responsive grid · error boundary · toasts | **P0** | 1 |
| **3 — Core flow** | Landing · auth polish + 401 refresh · onboarding · dashboard on real data · analyze · processing | **P0** | 2, BE-1 |
| **4 — Analysis experience** | Report at full desktop width · **Overview panel** · score with earned/lost · keywords with real per-keyword impact · quality · weak bullets · roadmap · **fix bugs 1–3** | **P0** | 2 |
| **5 — Optimization** | Diff view · accept/reject/edit · verify-this · verification-failed screen · before/after | **P0** | 4, BE-2 |
| **6 — Interview prep** | Weak areas · grouped questions · question detail | **P1** | 5 |
| **7 — Resume management** | My Scans → resume library · versions · compare · rename/duplicate/delete | **P1** | BE-5 |
| **8 — Auth & ownership** | Guard on `/scan` · scans belong to users · protected routes · server-side scan list | **P0** | BE-1 |
| **9 — Monetisation** | Credit ledger writes · free limits · pricing · Razorpay · transaction history · failed payment | **P1** | 5 |
| **10 — Testing** | Unit · integration · **AI hallucination evaluation** · E2E | **P0** | ongoing |
| **11 — Performance & security** | Indexing · rate limits · file validation · OWASP · monitoring · backups | **P1** | 10 |
| **12 — Real-user validation** | 20–30 users, funnel + qualitative | **P0** | 13 |
| **13 — Launch** | MVP | **P1** | 11 |
| **14 — Post-launch** | WhatsApp · mock interviews · analytics · portfolio analysis | **P2/P3** | 12 |

**Sequencing notes**

- Phase 8 is **P0 and should run alongside Phase 3**, not after it. Without it
  the dashboard cannot list scans, and the localStorage stopgap is shipping
  code that has to be deleted.
- Phase 10 is P0 and **continuous**, not a gate before launch. See H.
- Phase 9 must not start before Phase 5 is reliable. Charging for a rewrite
  flow that is still changing is how refunds happen.
- Phase 12 is the **kill switch** for everything after it.

---

# G. Backend changes required

Only what the UX needs. **No change to the AI orchestration.**

| # | Change | Unblocks | Size |
|---|---|---|---|
| **BE-1** | Optional JWT guard on `ScanController`; persist `userId`; add `GET /scans` (paginated, user-scoped) | Dashboard, library, ownership | S |
| **BE-2** | `POST /scan/:id/rescan` accepting a composed resume — wraps the existing `ScanPipeline.runFromStructured()` | Honest before/after on accepted changes | S |
| **BE-3** | `Scan.stage` written between waves; expose via `GET /scan/:id` or SSE | Staged processing screen | S |
| **BE-4** | Persist accepted/rejected decisions per change on `ResumeVersion` | Resume an interrupted review | S |
| **BE-5** | `Resume` entity; `ResumeVersion` hangs off it; `Scan` references it | Resume library, cross-job lineage | M |
| **BE-6** | Decouple `InterviewPrepSet` from rewrite — allow generation after a scan | Prep without paying for a rewrite | S |
| **BE-7** | Credit ledger writes, balance endpoint, spend on scan/rewrite, refund on failure | Free/paid gating, honest refund copy | M |
| **BE-8** | Razorpay order + webhook + `Transaction` | Payments | M |
| **BE-9** | Surface `recruiterComments` in `GET /scan/:id` | Already generated and discarded — free win | XS |
| **BE-10** | Fill `RATE_CARD` with verified Gemini pricing | Cost telemetry currently computes **zero** | XS |
| **BE-11** | Analytics event endpoint or client SDK | Funnel measurement | S |

**BE-2 is the one that matters.** Without it the product prints a headline
number describing a resume the user did not accept — on the screen whose only
job is proving the product worked.

---

# H. Testing plan

**Current state: there are no test files.** `npm test` runs jest against
nothing. Fifteen agents export `goldenTests` arrays that nothing executes.
This is the largest risk in the project and Phase 10 starts by fixing it.

### H.1 Backend unit

- `ScoreAggregator` — the 15 exported golden sets, actually run. Pure
  arithmetic, so assertions are exact.
- `DeterministicCheckAgent` — keyword match, `exactMatchPct`, metric
  detection, timeline gaps, contact validation.
- `RedisService.cacheKey` — **different options must produce different keys.**
  A collision here bills a PSU scan as a Startup scan.
- `completeStructured()` — schema failure → one repair → throw.

### H.2 AI evaluation — the safety-critical suite

`VerifyAgent` is the product's central promise and has **zero coverage**.
Build a fixture set of rewrites containing known fabrications and assert the
pipeline **fails closed** on every one:

| Fixture | Must be caught |
|---|---|
| Invented metric ("reduced latency 40%") | ✅ |
| Invented team size ("led 5 engineers") | ✅ |
| Invented employer | ✅ |
| Invented skill absent from the original | ✅ |
| Altered employment dates | ✅ |
| Invented seniority ("Senior" from "Junior") | ✅ |
| Unsupported achievement | ✅ |
| **Legitimate rephrasing** | ❌ must NOT be flagged (false-positive guard) |

Assert the terminal contract: on failure the returned `resume` is
**identical to the original** and `flaggedClaims` is non-empty. Track
precision and recall over time; a verifier that flags everything is as broken
as one that flags nothing.

### H.3 Backend integration

Scan pipeline end to end against fixtures · cache hit path consumes no model
call · rewrite retry loop · auth register/login/refresh/rotation · credit
spend and refund-on-failure.

### H.4 Frontend

Component tests for the design system (variants, disabled, loading, focus) ·
form validation · `mapScanToReportData()` against real payloads including
missing/null fields · responsive snapshots at all four breakpoints ·
accessibility assertions (axe) on every page.

### H.5 E2E (Playwright)

```
signup → onboarding → upload → analyze → report
      → optimize → accept → re-score → prep
```

Plus: verification-failure path · free-tier paywall · expired session ·
unreadable PDF · WhatsApp deep link into `/report/:scanId`.

### H.6 Non-functional

Scan p95 latency · cost per scan from `UsageLog` (blocked on BE-10) ·
rate-limit enforcement · file size and type validation.

---

# I. Launch checklist

**Technical** — all P0 phases done · E2E green · AI evaluation suite passing ·
error monitoring · structured logging · DB indexed and backed up · rate limits
· CORS locked to the real origin · secrets out of source · staging environment.

**Product** — every screen has loading/empty/error states · mobile verified on
real devices · WCAG AA (contrast, keyboard, focus, screen-reader score
announcements, no colour-only meaning) · copy reviewed for promises the
product cannot keep.

**Security & privacy** — resume retention policy stated · delete resume ·
delete account · JWT expiry and rotation verified · authorization checked
(one user cannot read another's scan) · file upload limits · OWASP top-10 pass
· no unsupported security claims in marketing.

**Monetisation** — credit ledger correct under concurrency · refund on
pipeline failure · Razorpay webhook idempotent · GST treatment decided ·
failed-payment recovery · pricing page matches enforcement.

**Analytics** — the full funnel instrumented:

```
signup · resume_uploaded · jd_submitted · scan_started · scan_completed
report_viewed · optimization_started · rewrite_accepted · rewrite_rejected
rescan_started · score_improved · interview_prep_opened
interview_question_viewed · upgrade_clicked · checkout_started
payment_completed
```

Plus two the brief omits and the product needs:
`verification_failed_shown` (how often the trust path fires) and
`claim_verification_responded` (whether users engage with flagged claims).

---

# J. Future — explicitly not MVP

**P2 — after real users**
Interview readiness as measured gap coverage · practice answers ·
application tracking · WhatsApp · multi-provider routing · referral flow
(`ReferralMessageAgent` already exists) · score simulation
("what if I add Docker?" — computable from D.7 with no model call).

**P3 — later**
Voice/video mock interviews · LinkedIn and portfolio analysis · campus and
placement-cell dashboards · portal scoring beyond Naukri · recruiter-side view
· resume A/B testing · regional languages.

**Prioritise by observed demand, not by what is technically possible.**

---

## The rule this document is optimised for

> How quickly can a user understand what is wrong with their resume, fix it,
> verify the improvement, and become better prepared for the interview?

Every phase above is ordered by that sentence. Phase 4 and Phase 5 — the
analysis experience and the optimization experience — are where the product
either earns trust or loses it, which is why they are P0 and why everything
decorative waits.
