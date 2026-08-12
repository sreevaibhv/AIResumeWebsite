# PARSE// — AI Resume Intelligence Platform for the Indian Job Market

Built against `PARSE_Master_Plan.md` (v2.0 — the doc of record; it explicitly
supersedes `Project_Scope_Requirements.md` and `PARSE_Complete_Build_Plan.md`
where they disagree). This README tracks what's actually built versus what
the master plan defers to later phases.

## What's here

```
backend/    NestJS + Prisma + Postgres(pgvector) + Redis — agent orchestrator + API
frontend/   Vite + React + React Router — "Signal" design system
```

## Status against the Master Plan's phases

**Phase 0 (Foundation) — done.** NestJS scaffold, full Prisma schema
including the four models the original plan omitted (`CreditLedger`,
`UsageLog`, `PricingVariant`, `Transaction`), `completeStructured()` LLM
abstraction built against three providers from the start (Anthropic, OpenAI,
Gemini) per §9's "retrofitting a second is where abstractions leak."

**Phase 1 (Prototype — validate the wedge) — done except live user testing.**
`ScanPipeline` runs end to end (Milestone 1, §12): `DeterministicCheckAgent`
+ `ScoreAggregator` (zero LLM cost), `ParseResumeAgent`, `ParseJDAgent`,
`SemanticMatchAgent` (pgvector-backed candidate matching), `QualityAgent`,
`NaukriScoreAgent`, `RoadmapAgent` — wired in the exact wave structure from
§8.3. `POST /scan` → `GET /scan/:id` works today once a database and at
least one LLM key are configured. **Not done: WhatsApp receiver (step 6) and
the 20–30 real-user test that's Phase 1's actual exit criteria** — that's a
distribution/testing step, not a code-writing one, and it's the kill switch
the whole rest of the plan is gated on (§1, §10).

**Phase 2 (Core product) — partially done.** Built: `TierCalibrationAgent`
(wired into `ScanPipeline`, fixing contradiction 13.4), `RewriteAgent` +
`VerifyAgent` with the **corrected fail-closed retry loop** (§13.2/FR-8a —
the source plan's loop shipped an unverified rewrite after exhausting
retries; this one returns the original resume + flagged claims instead,
never the unverified version), `RecruiterCommentAgent`,
`InterviewPrepAgent`, `RewritePipeline`, `POST /scan/:id/rewrite`,
`GET /scan/:id/diff`, `GET /scan/:id/interview-prep`. Frontend: E1
(scaffold), E3 (upload screen with tier + fresher toggles), E4 (scan report
wired to the live API, fallback loading state). Auth (D1/D2): JWT +
refresh-token rotation work; Google SSO is wired but inert until
`GOOGLE_CLIENT_ID`/`SECRET` are set. **Not done: E5 (dedicated before/after
diff screen), E6 (interview prep screen), E8 (streaming loading state — the
API currently returns after the full pipeline resolves, not
progressively).** The rewrite result renders inline on the Fixes tab today
instead.

**Phase 3 (Monetisation) — not started**, correctly: Razorpay, credit
gating enforcement, WhatsApp, referral flow, analytics events. The
`CreditLedger`/`Transaction`/`PricingVariant` tables exist; nothing writes
to them yet. `ReferralMessageAgent` exists but isn't wired to an endpoint.

**§14 (Government tier) — still the unresolved decision the plan flags.**
`TierCalibrationAgent` scopes Government down to structural guidance rather
than attempting bio-data generation, per the plan's third option — but the
plan says this needs an explicit product decision before Phase 2, and that
decision hasn't been made, just deferred safely.

## Corrections made while building (beyond what the plan already listed in §13)

- **NaukriScoreAgent circular dependency**: the plan's §8.3 wave design runs
  `NaukriScoreAgent` in parallel with `SemanticMatchAgent`/`QualityAgent`,
  *before* `ScoreAggregator` computes the generic score — so it cannot take
  the generic score as an input to explain the gap, despite the frontend
  mock implying it might. Fixed by having `NaukriScoreAgent` return only
  `naukriScore` + a qualitative `gapReason`; the numeric gap is computed
  downstream as `generic - naukri`, which is what the frontend
  (`ScorePanel`) already did in the original prototype.
- **Prisma 7 / driver adapters**: originally built against Prisma 5 (pinned
  in the plan's stack table); the actual current release is 7.9.1, which
  removed the datasource `url` from `schema.prisma` entirely. Migrated for
  real, not just silenced: connection URL for the CLI (migrate/generate)
  now lives in `backend/prisma.config.ts`; the runtime `PrismaClient` gets
  its connection via `@prisma/adapter-pg` in `common/prisma.service.ts`
  instead. Verified against the live CLI, not docs alone — `prisma
  generate`, `prisma validate`, `tsc --noEmit`, and `nest build` all pass
  clean on the migrated schema. TypeScript was deliberately **not** bumped
  to its current major (7.0.2) alongside this — `ts-node`/`ts-jest`
  compatibility with TS7's rewritten compiler internals is unverified, so
  the project stays on 5.x (resolves to 5.9.3) rather than gambling the
  whole toolchain on an immature major-version jump for no functional
  benefit.
- **Gemini-only routing (temporary)**: only `GEMINI_API_KEY` is provisioned
  right now, so `model-routing.ts` routes every agent to Gemini instead of
  the original Anthropic/OpenAI/Gemini split — Anthropic and OpenAI land
  later per the plan's own multi-provider design; this is a table edit, not
  an architecture change. Migrated off the legacy `@google/generative-ai`
  SDK to the current `@google/genai` package in the process (verified
  against its shipped `.d.ts`, not docs summaries, after the docs website
  gave conflicting signals about a newer "Interactions API").
  Two real bugs found only by running actual requests against the live API,
  not by typechecking:
  - `embedContent` silently treats a flat `contents: string[]` as **multiple
    parts of one content**, returning a single averaged embedding instead of
    one per term. Fixed by wrapping each term as its own `{ parts: [{ text
    }] }` content object — confirmed by direct API probe before and after.
  - `gemini-2.5-pro` (the original frontier-tier pick) has **zero free-tier
    quota** on this key — a hard `limit: 0`, not a rate limit — and
    `gemini-2.5-flash` 404s as fully deprecated for new accounts. Frontier
    tier now runs on `gemini-3.5-flash`, confirmed working live. This means
    `RewriteAgent`/`VerifyAgent` — including the FR-8 hallucination check —
    are currently running on a flash-class model, not a dedicated reasoning
    tier. Worth revisiting once billing is enabled or Anthropic/OpenAI are
    back.
  - Separately (not Gemini-specific): `tsconfig.json`'s `incremental: true`
    combined with `nest-cli.json`'s `deleteOutDir: true` caused a recurring
    broken build — `tsc` would skip re-emitting files it believed were
    already up to date, even right after `dist/` was wiped, because the
    `.tsbuildinfo` cache doesn't know the output was deleted. Removed
    `incremental` — this project is small enough that it isn't buying
    anything, and it was breaking builds silently (exit 0, empty `dist/`).
  Verified with a real end-to-end run: `POST /scan` against actual resume
  and JD text returned `201` with a coherent parsed resume/JD, a real
  weighted score blending deterministic and model signals, and a sensible
  prioritized roadmap — then confirmed rendering correctly in the browser
  against the live report screen (Score/Keywords/Fixes tabs, zero console
  errors).

## Running it

**Backend**
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL (Postgres with pgvector), REDIS_URL, and at least one LLM key
npm install
npx prisma migrate dev --name init   # requires a live Postgres with the vector extension available
npm run start:dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # proxies /api to http://localhost:3000 (see vite.config.js)
```

Both `npm install` and a full typecheck (`tsc --noEmit`) / production build
(`vite build`, `nest build`) were run against this code as part of building
it — both are clean. What hasn't been exercised is a live pipeline run,
since that needs a real Postgres+pgvector instance and real LLM API keys,
neither of which exist in this environment.

## Before this is real

1. Point `DATABASE_URL` at a Postgres instance with `CREATE EXTENSION vector;`
   available, run the migration, and confirm `ScanPipeline` actually
   produces a sane score against a real resume + JD — that's Milestone 1
   made real instead of just type-checking.
2. Confirm current model ids and per-token rates for all three providers
   (`backend/src/llm/model-routing.ts` — §11.1/§13.9 open decision). The
   Gemini/OpenAI model ids in there are reasonable defaults, not verified
   pricing.
3. Start WhatsApp Business verification if Phase 1's WhatsApp-first testing
   plan still holds — it has a multi-week lead time and was flagged as
   sitting unacknowledged on the 14-day critical path (§13.8).
4. Populate golden-set tests for every LLM agent (§8.1 step 4 — most are
   currently placeholder notes pointing at this task, not real golden sets,
   because they need real resume/JD text to be meaningful).
