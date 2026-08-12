import {
  DeterministicResult,
  SemanticMatchResult,
  QualityResult,
  NaukriResult,
  ParsedResume,
  ScanOptions,
  ScoreResult,
} from "./types";

/**
 * ScoreAggregator — Master Plan §8.2. No LLM call. Pure weighted arithmetic
 * merging DeterministicCheckAgent + SemanticMatchAgent + QualityAgent +
 * NaukriScoreAgent into a single 0-100 score with a per-category
 * {earned, max, reason, source} breakdown (§9, Phase 1 note: "build the
 * aggregator returning this shape on the first attempt" — it's what gives
 * the frontend's contribution bar, penalty breakdown, and FR-19 client-side
 * score simulator for free).
 *
 * Weights: Keyword coverage 30, Experience fit 20, Bullet quality 20,
 * Structure 15, Contact & format 15 — matches the categories the frontend
 * (ATSScanReport.jsx) already renders.
 */

const WEIGHTS = { keyword: 30, experience: 20, bullets: 20, structure: 15, contact: 15 };

function structureScore(resume: ParsedResume): { earned: number; note: string } {
  const checks: Array<[boolean, string]> = [
    [Boolean(resume.summary?.trim()), "Summary"],
    [resume.experience.length > 0, "Experience"],
    [resume.projects.length > 0, "Projects"],
    [resume.skills.length > 0, "Skills"],
    [resume.education.length > 0, "Education"],
  ];
  const present = checks.filter(([ok]) => ok);
  const earned = Math.round((present.length / checks.length) * WEIGHTS.structure);
  const missing = checks.filter(([ok]) => !ok).map(([, name]) => name);
  const note = missing.length
    ? `Missing sections: ${missing.join(", ")}`
    : "All expected sections present and ordered";
  return { earned, note };
}

function contactScore(det: DeterministicResult, resume: ParsedResume): { earned: number; note: string } {
  const fields = [
    Boolean(resume.contact.email),
    Boolean(resume.contact.phone),
    Boolean(resume.contact.linkedin),
    Boolean(resume.contact.github),
  ];
  const presentCount = fields.filter(Boolean).length;
  const base = det.contactValid ? WEIGHTS.contact * 0.7 : WEIGHTS.contact * 0.2;
  const bonus = (presentCount / fields.length) * WEIGHTS.contact * 0.3;
  const earned = Math.min(WEIGHTS.contact, Math.round(base + bonus));
  const note = det.contactValid
    ? `${presentCount} of ${fields.length} contact fields parse cleanly`
    : "Email or phone does not parse as valid";
  return { earned, note };
}

export function runScoreAggregator(
  det: DeterministicResult,
  semantic: SemanticMatchResult,
  quality: QualityResult,
  naukri: NaukriResult,
  resume: ParsedResume,
  options: ScanOptions,
): ScoreResult {
  const keywordEarned = Math.round((det.exactMatchPct / 100) * WEIGHTS.keyword);
  const experienceEarned = Math.round((semantic.experienceFitScore / 100) * WEIGHTS.experience);
  const bulletsEarned = Math.round((quality.bulletQualityScore / 100) * WEIGHTS.bullets);
  const structure = structureScore(resume);
  const contact = contactScore(det, resume);

  const criticalMissing = det.missingKeywords.filter((k) => k.priority === "critical").length;

  const categories = [
    {
      key: "Keyword coverage",
      earned: keywordEarned,
      max: WEIGHTS.keyword,
      reason: `${det.foundKeywords.length} of ${det.foundKeywords.length + det.missingKeywords.length} JD keywords present${criticalMissing ? `, ${criticalMissing} critical missing` : ""}`,
      source: "code" as const,
    },
    {
      key: "Experience fit",
      earned: experienceEarned,
      max: WEIGHTS.experience,
      reason: options.fresherMode ? `Fresher mode: ${semantic.seniorityFit}` : semantic.seniorityFit,
      source: "llm" as const,
    },
    {
      key: "Bullet quality",
      earned: bulletsEarned,
      max: WEIGHTS.bullets,
      reason: `${quality.weakBullets.length} weak bullets flagged`,
      source: "llm" as const,
    },
    { key: "Structure", earned: structure.earned, max: WEIGHTS.structure, reason: structure.note, source: "code" as const },
    { key: "Contact & format", earned: contact.earned, max: WEIGHTS.contact, reason: contact.note, source: "code" as const },
  ];

  const generic = categories.reduce((a, c) => a + c.earned, 0);

  return {
    generic,
    naukri: naukri.naukriScore,
    exactMatch: det.exactMatchPct,
    semanticMatch: semantic.semanticMatchPct,
    categories,
    gapReason: naukri.gapReason,
  };
}

// Golden tests — Master Plan §8.1, step 4.
export const goldenTests: Array<{
  inputs: [DeterministicResult, SemanticMatchResult, QualityResult, NaukriResult, ParsedResume, ScanOptions];
  expect: Partial<ScoreResult>;
}> = [
  {
    inputs: [
      {
        contactValid: true, lengthWords: 400, timelineGaps: [], actionVerbDensity: 0.8,
        metricBearingBulletRatio: 0.5, exactMatchPct: 60,
        foundKeywords: [{ term: "node.js", n: 3 }], missingKeywords: [], overusedPhrases: [],
      },
      { semanticMatchPct: 70, matches: [], missingResponsibilities: [], experienceFitScore: 80, seniorityFit: "Good fit", domainFit: "Aligned" },
      { sections: [], weakBullets: [], bulletQualityScore: 75, summaryScore: 60, summaryNote: "" },
      { naukriScore: 55, gapReason: "Headline mismatch" },
      {
        contact: { name: "A", email: "a@b.com", phone: "9876543210", linkedin: "x", github: "y" },
        headline: "H", summary: "S", experience: [{ title: "T", company: "C", start: "2023", end: "2024", bullets: [] }],
        projects: [{ name: "P", bullets: [] }], skills: ["Node"], education: [{ degree: "B.Tech", institution: "X", year: "2023" }],
        certifications: [],
      },
      { tier: "Startup", fresherMode: false },
    ],
    expect: { naukri: 55, exactMatch: 60, semanticMatch: 70 },
  },
];
