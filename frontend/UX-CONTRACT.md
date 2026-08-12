# PARSE// — frontend implementation contract

The full UX architecture (sitemap, wireframes, states, rationale) is the design
deliverable; this file is the part the code needs to agree with. Where the two
disagree, this file is wrong — it is a summary, not the source.

Everything below is checked against `backend/src` as of this writing. No
element is specified here that doesn't have a field behind it.

## Routes

| Route | Screen | Data |
| --- | --- | --- |
| `/` | Landing | static |
| `/how-it-works`, `/pricing` | Marketing | static, `PricingVariant` |
| `/login`, `/signup` | Auth | `POST /auth/*` |
| `/onboarding` | 3 questions, skippable | local until saved |
| `/app` | Dashboard | scan list |
| `/app/analyze` | New analysis, single page | `POST /scan` |
| `/app/analyze/:id/running` | Processing | poll `GET /scan/:id` |
| `/report/:scanId` | Report — 6 tabs, tab in hash | `GET /scan/:id` |
| `/report/:scanId/optimize` | Review AI changes | `POST /scan/:id/rewrite` |
| `/report/:scanId/result` | Before / after | `GET /scan/:id/diff` |
| `/report/:scanId/prep` | Interview prep | `GET /scan/:id/interview-prep` |
| `/app/scans` | Scan library | scan list |
| `/app/scans/:id/versions` | Version history | `ResumeVersion[]` |
| `/app/settings` | Account, plan, credits | `User`, `CreditLedger` |

Existing routes in `App.jsx` (`/` → upload, `/report/:scanId`) stay valid; `/`
becomes the landing page and the upload screen moves to `/app/analyze`.

Top-level nav is four items: Dashboard · Analyze · Scans · Settings. Prep and
version history are scan-scoped, never promoted to the nav.

## Headline scores — resolved

The brief asks for ATS Match / Resume Quality / Interview Readiness. Only two
of those have a data source. The third ring is the **portal score**, which is
the India differentiator and is the field the brief omits.

| Ring | Field | Agent |
| --- | --- | --- |
| Match | `score.generic` | `ScoreAggregator` |
| Portal score | `score.naukri`, gap = `generic − naukri`, `naukri.gapReason` | `NaukriScoreAgent` |
| Resume quality | `quality.sections[]` + `bulletQualityScore` | `QualityAgent` |

**Interview readiness is not a ring.** Nothing measures it. It is a *state* on
the prep screen ("unlocks after you optimize"). If the number is wanted later,
compute it as roadmap-coverage — that needs per-question progress tracking,
which no table records today.

## Report panels → fields

One route, one fetch, six panels.

| Panel | Reads |
| --- | --- |
| Overview | `score`, `roadmap[0..2]`, `details.*` |
| Score | `score.categories[]` — `earned`, `max`, `reason`, `source` |
| Keywords | `deterministic.{exactMatchPct,foundKeywords,missingKeywords,overusedPhrases}`, `semantic.{semanticMatchPct,matches}` |
| Quality | `quality.sections[]`, `quality.weakBullets[]` |
| Fixes | `roadmap[]` — `rank`, `fix`, `gain`, `conf`, `evidence` |
| Prep | `InterviewPrepSet.{technical,hr}` — locked until a rewrite exists |

Components read from `mapScanToReportData()`, never from the raw scan object.
That seam already exists in `ATSScanReport.jsx`; extend it rather than reaching
into `scan.details.deterministic` from a component.

## Hard rules

1. **Never print a point value next to a missing keyword.** `PRIORITY_GAIN` in
   `ATSScanReport.jsx` is a presentational heuristic — its own comment says so.
   Missing requirements get priority + `where`. Point estimates appear only on
   roadmap items, which carry a real `gain`, and are always prefixed `≈` with
   the `conf` value rendered beside them.

2. **Provenance is always visible.** `ScoreCategory.source` renders as
   `LOCAL` / `MODEL` on every score row. The `<Source>` component already
   exists. This is the product's core claim; it doesn't get dropped for
   density.

3. **Two distinct rewrite warnings, never conflated.**
   - *Fabricated metric* — the rewrite introduced a number absent from the
     original. Shown even when verification **passed**, because "traceable"
     is weaker than "true". Amber.
   - *Verification failed* — `status: "verification_failed"`. The pipeline
     kept the original and shipped nothing. Dedicated screen, red.

4. **Never expose model names, agent names, call counts or token spend.**
   `UsageLog` is for the operator.

5. **Every error states what happened to the user's data and to their money.**

## Free vs paid

Free keeps the whole diagnosis: all three scores, the full category breakdown,
all strengths and problems, the complete missing-requirements list, and the top
3 roadmap items (`FREE_ROADMAP_ITEMS = 3`, already implemented).

Paid buys the treatment: rewrite + verification, re-score, and interview prep.

The locked block shows the *shape* of what's behind it — "11 more fixes, worth
about +14" with the first two titles legible — never a blurred rectangle.
Upgrade is never the primary CTA on a result screen; the primary CTA is
"Fix my resume", and the paywall is the consequence of pressing it.

## Backend gaps this contract depends on

| # | Gap | Blocks | Fix |
| --- | --- | --- | --- |
| 1 | `ScanController` has no auth guard, so `Scan.userId` is always null | Dashboard, scan list, version history | Optional JWT guard passing `req.user.id`; keep anonymous scans working for the landing flow |
| 2 | Rewrite re-scores the model's **full** output only | Honest before/after when the user rejects a change | Expose `POST /scan/:id/rescan` over the existing `ScanPipeline.runFromStructured()` |
| 3 | `POST /scan` resolves only after all 3 waves | Staged progress screen | Write `Scan.stage` between waves; poll every 2s |
| 4 | Credit ledger tables exist but nothing writes to them | Real free/paid gating, refund copy | Phase 3; stub a `credits` field now |
| 5 | No `Resume` entity — `ResumeVersion` belongs to `Scan` | "My Resumes" with cross-job lineage | Not needed for v1: ship "My Scans" instead |

**Gap 2 is the one that matters.** Until it's closed, the result screen must
say "re-scored on all suggested changes" rather than "on the changes you
accepted", and rejecting a change must visibly invalidate the after-score
instead of silently keeping it. A product whose claim is "we show our working"
cannot print a headline number about a resume the user didn't accept.

## Notes

- `InterviewPrepSet` rows are only written inside `rewriteScan()`, and
  `getInterviewPrep()` throws otherwise. Prep is gated by *having optimized*,
  not by payment. Label the locked tab "Unlocks after you optimize".
- `InterviewPrepAgent` returns `technical[]` + `hr[]` only. The brief's six
  categories don't exist — group questions by **weak area** (derived from the
  roadmap the user already saw) with technical/HR as a secondary filter.
- `RecruiterCommentAgent` runs on every rewrite and its output is currently
  discarded by the UI. It's already paid for; render it as a short "how a
  recruiter reads this" note on Overview.
- Mobile drops the tab bar entirely: score → top problems → top fixes → sticky
  CTA, with detail panels as closed accordions. One ring, not three. This is
  the primary layout for WhatsApp arrivals, not a fallback.
- Signal tokens (`src/signal/tokens.js`) are the design system. First build
  task is lifting `Eyebrow`, `Chip`, `Card`, `Ring` and `Source` out of
  `ATSScanReport.jsx` into `src/signal/` so other screens consume them.
