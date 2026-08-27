import { computeVerdict } from "./verdict";
import { CeilingResult } from "./achievable-ceiling";
import { DeterministicResult, ParsedJD, ScoreResult } from "../agents/types";
import { KEYWORD_FLOOR, EXPERIENCE_FLOOR, TARGET_SCORE, BORDERLINE_BAND, SCORE_NOISE_BAND } from "./verdict.config";

function jd(overrides: Partial<ParsedJD> = {}): ParsedJD {
  return {
    title: "Backend Developer",
    company: "Acme",
    seniority: "Mid",
    minYearsExperience: 2,
    mustHaveSkills: ["Node.js", "Kubernetes"],
    niceToHaveSkills: ["Docker"],
    responsibilities: [],
    ...overrides,
  };
}

function det(overrides: Partial<DeterministicResult> = {}): DeterministicResult {
  return {
    contactValid: true,
    lengthWords: 200,
    timelineGaps: [],
    actionVerbDensity: 0.6,
    metricBearingBulletRatio: 0.5,
    exactMatchPct: 50,
    foundKeywords: [{ term: "node.js", n: 2 }],
    missingKeywords: [{ term: "kubernetes", priority: "critical", where: "Skills" }],
    overusedPhrases: [],
    ...overrides,
  };
}

function score(experienceEarned: number): ScoreResult {
  return {
    generic: 55,
    naukri: 50,
    exactMatch: 50,
    semanticMatch: 60,
    categories: [
      { key: "Keyword coverage", earned: 15, max: 30, reason: "", source: "code" },
      { key: "Experience fit", earned: experienceEarned, max: 20, reason: "Experience fit is thin for this role.", source: "llm" },
      { key: "Bullet quality", earned: 12, max: 20, reason: "", source: "llm" },
      { key: "Structure", earned: 12, max: 15, reason: "", source: "code" },
      { key: "Contact & format", earned: 11, max: 15, reason: "", source: "code" },
    ],
    gapReason: "",
  };
}

function ceiling(projectedScore: number): CeilingResult {
  return {
    currentScore: 55,
    projectedScore,
    projectedBand: { low: projectedScore - 5, high: projectedScore + 5 },
    gains: [{ category: "Keyword coverage", points: 10, source: "LOCAL", note: "1 confirmed keyword added" }],
  };
}

describe("computeVerdict", () => {
  it("returns DONT_APPLY with a keyword blocker when must-have coverage is below the floor", () => {
    // Only "node.js" found out of 2 must-haves = 50% coverage; with only 1 of 2 required and none confirmed, drop below floor explicitly
    const twoMustHaves = jd({ mustHaveSkills: ["Node.js", "Kubernetes", "gRPC", "Terraform"] }); // 1 of 4 found = 25% < 50% floor
    const result = computeVerdict(score(15), det(), twoMustHaves, ceiling(85), null);
    expect(result.verdict).toBe("DONT_APPLY");
    expect(result.reasons.some((r) => r.type === "blocker" && /must-have keyword/.test(r.text))).toBe(true);
  });

  it("returns DONT_APPLY with an experience blocker when experience fit is below the floor", () => {
    const result = computeVerdict(score(EXPERIENCE_FLOOR - 1), det(), jd(), ceiling(85), null);
    expect(result.verdict).toBe("DONT_APPLY");
    expect(result.reasons.some((r) => r.type === "blocker" && r.source === "MODEL")).toBe(true);
  });

  it("returns APPLY when both floors pass and the projected score clearly beats the target", () => {
    // Clearly outside SCORE_NOISE_BAND above TARGET_SCORE — right at TARGET_SCORE
    // itself is now covered by the noise-band tests below.
    const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE + SCORE_NOISE_BAND + 1), null);
    expect(result.verdict).toBe("APPLY");
    expect(result.reasons.every((r) => r.type !== "blocker")).toBe(true);
  });

  it("returns BORDERLINE when the projected score is within the band below target", () => {
    const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE - BORDERLINE_BAND), null);
    expect(result.verdict).toBe("BORDERLINE");
  });

  it("returns DONT_APPLY when floors pass but the projected score is far below target", () => {
    // Clearly outside SCORE_NOISE_BAND below the borderline floor — right at
    // the floor itself is now covered by the noise-band tests below.
    const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE - BORDERLINE_BAND - SCORE_NOISE_BAND - 1), null);
    expect(result.verdict).toBe("DONT_APPLY");
    // No floor breach -> no blocker reasons, just a verdict driven by the score gap
    expect(result.reasons.every((r) => r.type !== "blocker")).toBe(true);
  });

  it("counts a confirmed must-have keyword toward coverage even if the model never found it", () => {
    const fourMustHaves = jd({ mustHaveSkills: ["Node.js", "Kubernetes", "gRPC", "Terraform"] });
    const withoutConfirm = computeVerdict(score(15), det(), fourMustHaves, ceiling(85), null);
    const withConfirm = computeVerdict(score(15), det(), fourMustHaves, ceiling(85), { skills: ["kubernetes", "grpc"], contact: {} });
    expect(withoutConfirm.verdict).toBe("DONT_APPLY");
    // 1 found + 2 confirmed = 3 of 4 = 75% >= 50% floor
    expect(withConfirm.reasons.some((r) => /must-have keyword/.test(r.text))).toBe(false);
  });

  it(`keyword floor constant is ${KEYWORD_FLOOR}`, () => {
    expect(KEYWORD_FLOOR).toBeGreaterThan(0);
    expect(KEYWORD_FLOOR).toBeLessThanOrEqual(1);
  });

  describe("P0 — score-noise band", () => {
    it("resolves BORDERLINE, not APPLY, when projectedScore sits exactly at the apply threshold", () => {
      const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE), null);
      expect(result.verdict).toBe("BORDERLINE");
      expect(result.reasons.some((r) => r.type === "blocker" && /re-scoring/.test(r.text))).toBe(true);
    });

    it("resolves BORDERLINE, not APPLY, when projectedScore is just within the noise band above the apply threshold", () => {
      const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE + SCORE_NOISE_BAND), null);
      expect(result.verdict).toBe("BORDERLINE");
    });

    it("resolves APPLY (no noise reason) just one point outside the noise band above the apply threshold", () => {
      const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE + SCORE_NOISE_BAND + 1), null);
      expect(result.verdict).toBe("APPLY");
      expect(result.reasons.some((r) => /re-scoring/.test(r.text))).toBe(false);
    });

    it("resolves BORDERLINE, not DONT_APPLY, when projectedScore is just within the noise band below the borderline floor", () => {
      const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE - BORDERLINE_BAND - SCORE_NOISE_BAND), null);
      expect(result.verdict).toBe("BORDERLINE");
    });

    it("resolves DONT_APPLY (no noise reason) just one point outside the noise band below the borderline floor", () => {
      const result = computeVerdict(score(EXPERIENCE_FLOOR + 5), det(), jd(), ceiling(TARGET_SCORE - BORDERLINE_BAND - SCORE_NOISE_BAND - 1), null);
      expect(result.verdict).toBe("DONT_APPLY");
      expect(result.reasons.some((r) => /re-scoring/.test(r.text))).toBe(false);
    });

    it("a floor breach still forces DONT_APPLY even when the score would otherwise be in the noise zone", () => {
      // ceiling(TARGET_SCORE) is exactly on the apply seam, but experience
      // fit is below EXPERIENCE_FLOOR — the floor breach must win, not the
      // noise-band softening.
      const result = computeVerdict(score(EXPERIENCE_FLOOR - 1), det(), jd(), ceiling(TARGET_SCORE), null);
      expect(result.verdict).toBe("DONT_APPLY");
      expect(result.reasons.some((r) => /re-scoring/.test(r.text))).toBe(false);
    });
  });
});
