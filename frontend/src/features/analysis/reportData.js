import { scoreLabel } from "../../design-system";

/**
 * The one seam between the API payload and the report UI.
 *
 * Panels read from this object, never from `scan.details.*` directly,
 * so a backend field rename touches one function.
 */

/** FR-17 — the free tier sees the score and the top three fixes. */
export const FREE_ROADMAP_ITEMS = 3;

// GOVERNMENT is a legacy value — the backend no longer writes it (folded
// into PSU by TierDetectionAgent) but old rows may still carry it.
const TIER_LABEL = {
  STARTUP: "Startup",
  MNC: "MNC",
  PSU: "PSU",
  GOVERNMENT: "PSU",
};

/** Prisma's Tier enum → display label. Naive title-casing gives "Mnc"/"Psu". */
export const tierLabel = (tier) => TIER_LABEL[tier] ?? tier ?? "—";

/**
 * What one missing keyword is actually worth.
 *
 * This used to be a `PRIORITY_GAIN` lookup whose own comment admitted it
 * was "presentational only". It never needed to be invented — the value
 * falls straight out of the scoring code:
 *
 *   exactMatchPct = found / totalJdSkills × 100        (DeterministicCheckAgent)
 *   keywordEarned = exactMatchPct / 100 × maxPoints    (ScoreAggregator)
 *   ⇒ one keyword  = maxPoints / totalJdSkills
 *
 * `maxPoints` is read from the payload's own category rather than
 * hardcoded, so re-weighting the aggregator does not silently make this
 * number wrong.
 *
 * It is the *direct* keyword gain only — naming Docker may also lift
 * semantic match and bullet quality. Those knock-on effects are what the
 * roadmap's model-estimated `gain` captures, which is why the two are
 * shown as separate, differently-badged numbers.
 */
function keywordImpact(categories, totalJdSkills) {
  if (!totalJdSkills) return 0;
  const keywordCategory = categories.find((c) => /keyword/i.test(c.key));
  const maxPoints = keywordCategory?.max ?? 30;
  return maxPoints / totalJdSkills;
}

/**
 * Restore a skill's original capitalisation for display.
 *
 * DeterministicCheckAgent lowercases every term before matching
 * (`normalize()` = toLowerCase + trim), so `missingKeywords[].term`
 * comes back as "rest apis" and "docker". Rendering that verbatim makes
 * the report look careless about the technologies it is naming. The
 * parsed JD still holds the posting's own casing, so we key off that
 * and fall back to the normalised form when there is no match.
 */
function buildCasingMap(jd) {
  const map = new Map();
  for (const skill of [...(jd.mustHaveSkills ?? []), ...(jd.niceToHaveSkills ?? [])]) {
    if (typeof skill === "string") map.set(skill.toLowerCase().trim(), skill.trim());
  }
  return map;
}

/** Semantic confidence → a match state the ledger can label. */
function matchState(conf) {
  if (conf >= 0.85) return "exact";
  if (conf >= 0.7) return "semantic";
  return "partial";
}

export function mapScanToReport(scan) {
  const det = scan.details?.deterministic ?? {};
  const quality = scan.details?.quality ?? {};
  const semantic = scan.details?.semantic ?? {};
  const tierCalibration = scan.details?.tierCalibration ?? null;
  const score = scan.score ?? {};
  const jd = scan.jdParsed ?? {};
  const resume = scan.resumeParsed ?? {};

  const categories = score.categories ?? [];
  const casing = buildCasingMap(jd);
  const display = (term) => casing.get(String(term).toLowerCase().trim()) ?? term;

  const confirmedSkills = scan.confirmedSkills ?? { skills: [], contact: {} };
  const confirmedTerms = new Set((confirmedSkills.skills ?? []).map((s) => s.toLowerCase().trim()));

  const found = (det.foundKeywords ?? []).map((f) => ({ ...f, term: display(f.term) }));
  const missing = (det.missingKeywords ?? []).map((m) => ({
    ...m,
    term: display(m.term),
    confirmed: confirmedTerms.has(String(m.term).toLowerCase().trim()),
  }));
  const totalJdSkills = found.length + missing.length;
  const perKeywordImpact = keywordImpact(categories, totalJdSkills);

  // Resume quality: the average of the model's per-section scores, with
  // the section breakdown shown directly beneath it so the number is
  // never a black box. Falls back to bullet quality if sections are absent.
  const sections = quality.sections ?? [];
  const qualityScore = sections.length
    ? Math.round(sections.reduce((a, s) => a + (s.score ?? 0), 0) / sections.length)
    : quality.bulletQualityScore ?? null;

  const generic = score.generic ?? 0;
  const naukri = score.naukri ?? 0;
  // Positive = weaker on the portal than on a generic ATS.
  const portalGap = generic - naukri;

  /* ---------- strengths and problems ----------
     Re-presented from the reasons the backend already produced, rather
     than generated here. Nothing in this section is invented. */

  const strengths = [
    ...categories
      .filter((c) => c.max > 0 && c.earned / c.max >= 0.8)
      .map((c) => ({ text: c.reason, meta: `${c.key} ${c.earned}/${c.max}`, source: c.source })),
    ...(found.length
      ? [{
          text: `${found.length} of ${totalJdSkills} required skills appear in your resume`,
          meta: found.slice(0, 4).map((f) => f.term).join(", "),
          source: "code",
        }]
      : []),
  ];

  const criticalMissing = missing.filter((m) => m.priority === "critical");

  const problems = [
    ...criticalMissing.slice(0, 3).map((m) => ({
      text: `${m.term} is a must-have and does not appear anywhere in your resume`,
      meta: `Add it to: ${m.where}`,
      tone: "critical",
      source: "code",
    })),
    ...categories
      .filter((c) => c.max > 0 && c.earned / c.max < 0.5)
      .map((c) => ({
        text: c.reason,
        meta: `${c.key} — ${c.max - c.earned} points lost`,
        tone: c.earned / c.max < 0.25 ? "critical" : "warn",
        source: c.source,
      })),
    ...(quality.weakBullets?.length
      ? [{
          text: `${quality.weakBullets.length} bullets carry no measurable outcome`,
          meta: "See the Quality tab",
          tone: "warn",
          source: "llm",
        }]
      : []),
  ];

  /* ---------- requirement ledger ---------- */

  const semanticByJd = new Map((semantic.matches ?? []).map((m) => [m.jd?.toLowerCase?.(), m]));

  const requirements = [
    ...found.map((f) => {
      const sem = semanticByJd.get(f.term?.toLowerCase?.());
      return {
        term: f.term,
        state: sem && sem.conf < 0.85 ? matchState(sem.conf) : "exact",
        evidence: sem?.resume ?? `Mentioned ${f.n}×`,
        confidence: sem?.conf,
        impact: null,
      };
    }),
    ...missing.map((m) => ({
      term: m.term,
      state: "missing",
      evidence: null,
      where: m.where,
      priority: m.priority,
      impact: perKeywordImpact,
    })),
  ];

  return {
    id: scan.id,
    status: scan.status,
    role: jd.title ?? "Untitled role",
    company: jd.company ?? null,
    seniority: jd.seniority ?? null,
    tier: tierLabel(scan.tier),
    fresherMode: scan.fresherMode,
    candidate: resume.contact?.name ?? null,
    contact: resume.contact ?? {},
    createdAt: scan.createdAt,

    // headline
    generic,
    naukri,
    qualityScore,
    portalGap,
    gapReason: score.gapReason ?? naukri?.gapReason ?? "",
    scoreLabel: scoreLabel(generic),
    exactMatch: score.exactMatch ?? det.exactMatchPct ?? 0,
    semanticMatch: score.semanticMatch ?? semantic.semanticMatchPct ?? 0,

    // spec §3 — should-I-apply verdict, computed server-side as pure
    // arithmetic (currentScore/projectedScore/band/reasons/requiredChanges).
    // Null only if the scan predates verdict computation.
    verdict: scan.verdict ?? null,
    confirmedSkills,

    categories,
    strengths,
    problems,

    keywords: {
      found,
      missing,
      overused: det.overusedPhrases ?? [],
      totalJdSkills,
      perKeywordImpact,
      requirements,
      semanticMatches: semantic.matches ?? [],
      missingResponsibilities: semantic.missingResponsibilities ?? [],
    },

    quality: {
      score: qualityScore,
      sections,
      weakBullets: quality.weakBullets ?? [],
      summaryNote: quality.summaryNote ?? "",
      bulletQualityScore: quality.bulletQualityScore ?? null,
    },

    fit: {
      seniority: semantic.seniorityFit ?? "",
      domain: semantic.domainFit ?? "",
    },

    tierCalibration,

    roadmap: (scan.roadmap ?? []).map((r) => ({ ...r, locked: r.rank > FREE_ROADMAP_ITEMS })),
    lockedCount: Math.max(0, (scan.roadmap ?? []).length - FREE_ROADMAP_ITEMS),
    lockedGain: (scan.roadmap ?? [])
      .filter((r) => r.rank > FREE_ROADMAP_ITEMS)
      .reduce((n, r) => n + (r.gain ?? 0), 0),

    hasPrep: (scan.interviewPreps ?? []).length > 0,
    prep: (() => {
      const latest = (scan.interviewPreps ?? []).slice(-1)[0];
      return latest ? { technical: latest.technical ?? [], hr: latest.hr ?? [] } : null;
    })(),
    isOptimized: (scan.resumeVersions ?? []).some((v) => v.kind === "rewritten" && v.verified),
  };
}
