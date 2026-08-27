import { runSemanticMatchAgent } from "./semantic-match.agent";
import { runQualityAgent } from "./quality.agent";
import { runNaukriScoreAgent } from "./naukri-score.agent";
import { runDeterministicCheck } from "./deterministic-check.agent";
import { runScoreAggregator } from "./score-aggregator";
import { ParsedResume, ParsedJD, ScanOptions } from "./types";
import { CandidatePair } from "../vector/vector-store.interface";

/**
 * P0 — score-stability definition of done. Re-scoring the identical resume
 * against the identical JD was observed swinging materially (72->55->82 in
 * manual curl testing). A throwaway diagnostic script (not committed) found
 * the dominant cause: SemanticMatchAgent/QualityAgent/NaukriScoreAgent's
 * 0-100 score fields had no `.int()` constraint and no explicit "not a 0-1
 * fraction" instruction, so the model occasionally emitted e.g. 0.95
 * instead of 95 — passes `.min(0).max(100)` silently, then
 * score-aggregator's (score/100)*weight arithmetic collapses a 95% judgment
 * to ~0 earned points. That fix (.int() + explicit prompt wording, see each
 * agent's OutputSchema) plus temperature:0 is what this test verifies
 * empirically, against the live model — not just that the schema now
 * rejects a fraction in theory, but that real repeat calls stay both
 * integer-valued and within a tight tolerance.
 *
 * Only 3 repeat calls per agent, not more — the free-tier Gemini quota is a
 * real 5 RPM cap, hit live during this session's own diagnostic run.
 *
 * Skips (not fails) without GEMINI_API_KEY, same as every other golden test.
 */
const HAS_KEY = Boolean(process.env.GEMINI_API_KEY);
const maybeIt = HAS_KEY ? it : it.skip;

const RUNS = 3;
const GENERIC_SCORE_TOLERANCE = 6; // initial placeholder — tune from this test's own measured spread once real post-fix data exists, same spirit as verdict.config.ts's other constants

const resume: ParsedResume = {
  contact: { name: "Jane Doe", email: "jane.doe@example.com", phone: "9876543210", linkedin: "linkedin.com/in/janedoe" },
  headline: "Backend Developer",
  summary: "Backend engineer with 3 years building payment services.",
  experience: [
    {
      title: "Backend Developer",
      company: "Acme Corp",
      start: "2022-01",
      end: "Present",
      bullets: [
        "Built a reconciliation service handling 10k requests per second",
        "Reduced checkout latency by 40 percent",
      ],
    },
  ],
  projects: [],
  skills: ["Node.js", "PostgreSQL"],
  education: [{ degree: "B.Tech CSE", institution: "NIT Trichy", year: "2021" }],
  certifications: [],
};

const jd: ParsedJD = {
  title: "Backend Developer",
  company: "Zeta",
  seniority: "Mid",
  minYearsExperience: 2,
  mustHaveSkills: ["Node.js", "PostgreSQL", "Kubernetes"],
  niceToHaveSkills: ["gRPC"],
  responsibilities: [
    "Build and maintain backend services",
    "Work with distributed systems",
    "Collaborate cross-functionally to deliver reliable software at scale",
  ],
};

const candidates: CandidatePair[] = [
  { resumeTerm: "node.js", jdTerm: "node.js", similarity: 1 },
  { resumeTerm: "postgresql", jdTerm: "postgresql", similarity: 1 },
];

const options: ScanOptions = { fresherMode: false };

function isWholeIntegerInRange(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

describe("Score stability eval", () => {
  if (!HAS_KEY) {
    it.skip("skipped — GEMINI_API_KEY is not set", () => {});
  }

  maybeIt(
    "re-scoring the identical resume+JD stays integer-valued and within tolerance across repeat calls",
    async () => {
      const det = runDeterministicCheck(resume, jd);

      const semanticFitScores: number[] = [];
      const semanticMatchPcts: number[] = [];
      const bulletQualityScores: number[] = [];
      const naukriScores: number[] = [];
      const genericScores: number[] = [];

      for (let i = 0; i < RUNS; i++) {
        const [semantic, quality, naukri] = await Promise.all([
          runSemanticMatchAgent(resume, jd, candidates, options),
          runQualityAgent(resume),
          runNaukriScoreAgent(resume, jd, det),
        ]);

        // The direct, falsifiable check that the units bug is actually
        // closed — not just that .int() exists in the schema, but that the
        // live model's real output satisfies it across repeat calls.
        expect(isWholeIntegerInRange(semantic.data.experienceFitScore)).toBe(true);
        expect(isWholeIntegerInRange(semantic.data.semanticMatchPct)).toBe(true);
        expect(isWholeIntegerInRange(quality.data.bulletQualityScore)).toBe(true);
        expect(isWholeIntegerInRange(quality.data.summaryScore)).toBe(true);
        for (const section of quality.data.sections) {
          expect(isWholeIntegerInRange(section.score)).toBe(true);
        }
        expect(isWholeIntegerInRange(naukri.data.naukriScore)).toBe(true);

        semanticFitScores.push(semantic.data.experienceFitScore);
        semanticMatchPcts.push(semantic.data.semanticMatchPct);
        bulletQualityScores.push(quality.data.bulletQualityScore);
        naukriScores.push(naukri.data.naukriScore);

        const score = runScoreAggregator(det, semantic.data, quality.data, naukri.data, resume, options);
        genericScores.push(score.generic);
      }

      // eslint-disable-next-line no-console
      console.log("score-stability spread", {
        experienceFitScore: semanticFitScores,
        semanticMatchPct: semanticMatchPcts,
        bulletQualityScore: bulletQualityScores,
        naukriScore: naukriScores,
        generic: genericScores,
      });

      expect(spread(genericScores)).toBeLessThanOrEqual(GENERIC_SCORE_TOLERANCE);
    },
    120000,
  );
});
