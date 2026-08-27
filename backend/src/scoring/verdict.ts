import { ScoreResult, DeterministicResult, ParsedJD } from "../agents/types";
import { CeilingResult, ConfirmedSkills } from "./achievable-ceiling";
import { TARGET_SCORE, BORDERLINE_BAND, KEYWORD_FLOOR, EXPERIENCE_FLOOR, SCORE_NOISE_BAND } from "./verdict.config";

/**
 * Verdict — spec §3. Pure code, no LLM. The headline runs on the overall
 * projected score; the two floors override it, because they are the only
 * gaps honest rewriting cannot close (a must-have keyword gate the portal
 * itself screens on, and an experience/seniority mismatch). Everything
 * else is a `gain` reason, not a blocker.
 *
 * Copy discipline: reason text is diagnosis, never promise — "competitive
 * range," never "you'll get the interview."
 */

export type VerdictLabel = "APPLY" | "BORDERLINE" | "DONT_APPLY";

export interface VerdictReason {
  type: "gain" | "blocker";
  text: string;
  source: "LOCAL" | "MODEL";
}

export interface VerdictResult {
  verdict: VerdictLabel;
  currentScore: number;
  projectedScore: number;
  projectedBand: { low: number; high: number };
  reasons: VerdictReason[];
  requiredChanges: string[];
}

function normalize(term: string): string {
  return term.toLowerCase().trim();
}

export function computeVerdict(
  score: ScoreResult,
  det: DeterministicResult,
  jd: ParsedJD,
  ceiling: CeilingResult,
  confirmed: ConfirmedSkills | null,
): VerdictResult {
  const mustHave = Array.from(new Set(jd.mustHaveSkills.map(normalize)));
  const foundTerms = new Set(det.foundKeywords.map((f) => normalize(f.term)));
  const confirmedTerms = new Set((confirmed?.skills ?? []).map(normalize));
  const coveredCount = mustHave.filter((t) => foundTerms.has(t) || confirmedTerms.has(t)).length;
  const keywordCoverage = mustHave.length ? coveredCount / mustHave.length : 1;

  const experienceCategory = score.categories.find((c) => /experience/i.test(c.key));
  const experiencePoints = experienceCategory?.earned ?? 0;

  const keywordFloorBreach = keywordCoverage < KEYWORD_FLOOR;
  const experienceFloorBreach = experiencePoints < EXPERIENCE_FLOOR;
  const floorBreach = keywordFloorBreach || experienceFloorBreach;

  // P0 — don't commit to a hard APPLY/DONT_APPLY label when projectedScore
  // sits close enough to either seam that repeat-scoring noise could flip
  // it. Distinct from BORDERLINE_BAND's static margin below.
  const nearApplySeam = Math.abs(ceiling.projectedScore - TARGET_SCORE) <= SCORE_NOISE_BAND;
  const nearDontApplySeam = Math.abs(ceiling.projectedScore - (TARGET_SCORE - BORDERLINE_BAND)) <= SCORE_NOISE_BAND;
  const inNoiseZone = !floorBreach && (nearApplySeam || nearDontApplySeam);

  let verdict: VerdictLabel;
  if (floorBreach) {
    verdict = "DONT_APPLY";
  } else if (inNoiseZone) {
    verdict = "BORDERLINE";
  } else if (ceiling.projectedScore >= TARGET_SCORE) {
    verdict = "APPLY";
  } else if (ceiling.projectedScore >= TARGET_SCORE - BORDERLINE_BAND) {
    verdict = "BORDERLINE";
  } else {
    verdict = "DONT_APPLY";
  }

  const reasons: VerdictReason[] = [];

  if (inNoiseZone) {
    reasons.push({
      type: "blocker",
      text: `Your projected score (${ceiling.projectedScore}) is close enough to the apply threshold that re-scoring the same resume could land on either side — treat this as borderline, not a confident verdict.`,
      source: "MODEL",
    });
  }

  if (keywordFloorBreach) {
    reasons.push({
      type: "blocker",
      text: `Only ${Math.round(keywordCoverage * 100)}% of must-have keywords are present or confirmed — below the ${Math.round(KEYWORD_FLOOR * 100)}% floor this role screens on.`,
      source: "LOCAL",
    });
  }
  if (experienceFloorBreach) {
    reasons.push({
      type: "blocker",
      text: experienceCategory?.reason ?? "Experience fit is below the floor for this role.",
      source: "MODEL",
    });
  }

  for (const g of ceiling.gains) {
    if (g.points > 0) {
      reasons.push({ type: "gain", text: `${g.note} → +${g.points}`, source: g.source });
    }
  }

  const requiredChanges = ceiling.gains.filter((g) => g.points > 0).map((g) => g.note);

  return {
    verdict,
    currentScore: ceiling.currentScore,
    projectedScore: ceiling.projectedScore,
    projectedBand: ceiling.projectedBand,
    reasons,
    requiredChanges,
  };
}
