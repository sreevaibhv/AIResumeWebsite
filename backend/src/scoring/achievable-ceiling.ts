import { DeterministicResult, QualityResult, ParsedResume, ScoreResult } from "../agents/types";
import { WEIGHTS } from "../agents/score-aggregator";

/**
 * AchievableCeiling — spec §2. Pure code, no LLM. Projects the best score
 * an honest improve pass could reach, split by provenance:
 *
 *   LOCAL  (exact)     — keyword insertion, recoverable-section fill,
 *                        email/phone repair, confirmed profile links.
 *   MODEL  (estimated)  — bullet reframing (banded, confidence-weighted).
 *
 * Experience fit is deliberately never projected above 0 gain — years of
 * seniority cannot be rewritten into existence (invariant #1).
 *
 * Two rules narrower than a literal reading of the spec, both in service of
 * invariant #1 ("zero invention"):
 *
 *   - "Recoverable" sections are Summary and Skills only. RewriteAgent can
 *     write a summary from existing content and surface an already-evidenced
 *     skill. A missing Experience/Projects/Education section means the
 *     candidate lacks that content — crediting it as gain would project a
 *     score reachable only by fabrication.
 *   - Contact's *guaranteed* gain is the email/phone-validity repair only.
 *     LinkedIn/GitHub only count once the caller supplies a `confirmed`
 *     profile URL (via POST /scan/:id/confirm) — a tickbox tells us a
 *     profile exists but gives improve nothing honest to insert.
 */

export interface ConfirmedSkills {
  /** Normalized (lowercased, trimmed) must-have keyword terms the user confirmed they actually have. */
  skills: string[];
  contact: { linkedin?: string; github?: string };
}

export type GainSource = "LOCAL" | "MODEL";

export interface CeilingGain {
  category: string;
  points: number;
  source: GainSource;
  confidence?: "high" | "medium" | "low";
  note: string;
}

export interface CeilingResult {
  currentScore: number;
  projectedScore: number;
  projectedBand: { low: number; high: number };
  gains: CeilingGain[];
}

function normalize(term: string): string {
  return term.toLowerCase().trim();
}

function allBullets(resume: ParsedResume): string[] {
  return [
    ...resume.experience.flatMap((e) => e.bullets),
    ...resume.projects.flatMap((p) => p.bullets),
  ];
}

/** Same fraction-of-max arithmetic as ScoreAggregator's contactScore bonus term. */
function contactFieldBonus(): number {
  return (1 / 4) * WEIGHTS.contact * 0.3;
}

export function computeCeiling(
  score: ScoreResult,
  det: DeterministicResult,
  quality: QualityResult,
  resume: ParsedResume,
  confirmed: ConfirmedSkills | null,
): CeilingResult {
  const gains: CeilingGain[] = [];
  const totalJdSkills = det.foundKeywords.length + det.missingKeywords.length;

  // ---------- Keyword coverage (LOCAL, exact) ----------
  const confirmedSkillSet = new Set((confirmed?.skills ?? []).map(normalize));
  const confirmedMissing = det.missingKeywords.filter(
    (k) => k.priority === "critical" && confirmedSkillSet.has(normalize(k.term)),
  );
  const perKeywordImpact = totalJdSkills ? WEIGHTS.keyword / totalJdSkills : 0;
  const keywordGain = Math.round(confirmedMissing.length * perKeywordImpact);
  gains.push({
    category: "Keyword coverage",
    points: keywordGain,
    source: "LOCAL",
    note: confirmedMissing.length
      ? `${confirmedMissing.length} confirmed must-have keyword(s) added`
      : "No confirmed missing keywords yet",
  });

  // ---------- Structure (LOCAL, exact) — Summary/Skills only are recoverable ----------
  const perSectionImpact = WEIGHTS.structure / 5; // structureScore checks 5 sections
  const recoverableMissing = [
    !resume.summary?.trim(),
    resume.skills.length === 0,
  ].filter(Boolean).length;
  const structureGain = Math.round(recoverableMissing * perSectionImpact);
  gains.push({
    category: "Structure",
    points: structureGain,
    source: "LOCAL",
    note: recoverableMissing
      ? `${recoverableMissing} recoverable section(s) can be filled from existing content`
      : "No recoverable sections missing",
  });

  // ---------- Contact & format (LOCAL, exact) ----------
  // Two multiplications, not one subtraction-then-multiply — matches
  // contactScore's own arithmetic in score-aggregator.ts (WEIGHTS.contact*0.7
  // vs *0.2) and avoids the float error `0.7 - 0.2` introduces (0.49999999999999994).
  const emailPhoneGain = det.contactValid ? 0 : Math.round(WEIGHTS.contact * 0.7 - WEIGHTS.contact * 0.2);
  const hasLinkedin = Boolean(resume.contact.linkedin);
  const hasGithub = Boolean(resume.contact.github);
  const confirmsNewLinkedin = Boolean(confirmed?.contact.linkedin) && !hasLinkedin;
  const confirmsNewGithub = Boolean(confirmed?.contact.github) && !hasGithub;
  const fieldBonus = contactFieldBonus();
  const confirmedProfileGain = Math.round(
    (confirmsNewLinkedin ? fieldBonus : 0) + (confirmsNewGithub ? fieldBonus : 0),
  );
  const contactGain = emailPhoneGain + confirmedProfileGain;
  gains.push({
    category: "Contact & format",
    points: contactGain,
    source: "LOCAL",
    note: [
      !det.contactValid ? "Email/phone formatting can be repaired" : null,
      confirmsNewLinkedin || confirmsNewGithub ? "Confirmed profile link(s) added" : null,
    ].filter(Boolean).join("; ") || "No contact repair available",
  });

  // ---------- Bullet quality (MODEL, banded) ----------
  const bulletsCategory = score.categories.find((c) => /bullet/i.test(c.key));
  const bulletsMax = bulletsCategory?.max ?? WEIGHTS.bullets;
  const bulletsEarned = bulletsCategory?.earned ?? 0;
  const bulletsUnearned = Math.max(0, bulletsMax - bulletsEarned);
  const totalBullets = allBullets(resume).length;
  const weakFraction = totalBullets ? quality.weakBullets.length / totalBullets : 0;
  const bulletsEstimate = Math.min(bulletsUnearned, Math.round(weakFraction * bulletsMax));
  gains.push({
    category: "Bullet quality",
    points: bulletsEstimate,
    source: "MODEL",
    confidence: "medium",
    note: quality.weakBullets.length
      ? `${quality.weakBullets.length} weak bullet(s) could be reframed against real content`
      : "No weak bullets flagged",
  });

  // ---------- Experience fit (MODEL, always 0) ----------
  gains.push({
    category: "Experience fit",
    points: 0,
    source: "MODEL",
    confidence: "low",
    note: "Years of experience and seniority cannot be rewritten into existence",
  });

  const guaranteedLocal = gains.filter((g) => g.source === "LOCAL").reduce((a, g) => a + g.points, 0);
  const modelEstimate = bulletsEstimate; // the only nonzero MODEL gain

  const currentScore = score.generic;
  const projectedScore = Math.min(100, currentScore + guaranteedLocal + Math.round(modelEstimate * 0.7));
  const low = Math.min(100, currentScore + guaranteedLocal + Math.round(modelEstimate * 0.4));
  const high = Math.min(100, currentScore + guaranteedLocal + modelEstimate);

  return {
    currentScore,
    projectedScore,
    projectedBand: { low, high },
    gains,
  };
}
