import { computeCeiling } from "./achievable-ceiling";
import { DeterministicResult, ParsedResume, QualityResult, ScoreResult } from "../agents/types";

function resume(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
    headline: "Backend Developer",
    summary: "Backend engineer with 3 years of experience.",
    experience: [{ title: "Backend Developer", company: "Acme", start: "2022", end: "Present", bullets: ["Built a service handling 10k rps", "Helped with maintenance"] }],
    projects: [],
    skills: ["Node.js"],
    education: [{ degree: "B.Tech", institution: "X", year: "2021" }],
    certifications: [],
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
    missingKeywords: [
      { term: "kubernetes", priority: "critical", where: "Skills" },
      { term: "docker", priority: "important", where: "Skills" },
    ],
    overusedPhrases: [],
    ...overrides,
  };
}

function quality(overrides: Partial<QualityResult> = {}): QualityResult {
  return {
    sections: [],
    weakBullets: [{ text: "Helped with maintenance", why: "Passive, no scope", fix: "Name the system" }],
    bulletQualityScore: 60,
    summaryScore: 70,
    summaryNote: "",
    ...overrides,
  };
}

function score(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    generic: 55,
    naukri: 50,
    exactMatch: 50,
    semanticMatch: 60,
    categories: [
      { key: "Keyword coverage", earned: 15, max: 30, reason: "1 of 2 found", source: "code" },
      { key: "Experience fit", earned: 12, max: 20, reason: "Reasonable fit", source: "llm" },
      { key: "Bullet quality", earned: 12, max: 20, reason: "1 weak bullet", source: "llm" },
      { key: "Structure", earned: 12, max: 15, reason: "All present", source: "code" },
      { key: "Contact & format", earned: 11, max: 15, reason: "Contact ok", source: "code" },
    ],
    gapReason: "",
    ...overrides,
  };
}

describe("computeCeiling", () => {
  it("credits zero keyword gain with no confirmations", () => {
    const result = computeCeiling(score(), det(), quality(), resume(), null);
    const keyword = result.gains.find((g) => g.category === "Keyword coverage")!;
    expect(keyword.points).toBe(0);
  });

  it("credits keyword gain only for confirmed critical (must-have) terms", () => {
    const result = computeCeiling(score(), det(), quality(), resume(), { skills: ["kubernetes"], contact: {} });
    const keyword = result.gains.find((g) => g.category === "Keyword coverage")!;
    // WEIGHTS.keyword=30, totalJdSkills = 1 found + 2 missing = 3 -> 30/3 = 10 per keyword
    expect(keyword.points).toBe(10);
  });

  it("never credits a confirmed nice-to-have/important term, only critical ones", () => {
    const result = computeCeiling(score(), det(), quality(), resume(), { skills: ["docker"], contact: {} });
    const keyword = result.gains.find((g) => g.category === "Keyword coverage")!;
    expect(keyword.points).toBe(0);
  });

  it("credits structure gain only for missing summary/skills, not experience/projects/education", () => {
    const bareResume = resume({ summary: "", skills: [], projects: [], experience: [] });
    // experience/projects/education missing must NOT be credited — invariant #1
    const result = computeCeiling(score(), det(), quality(), bareResume, null);
    const structure = result.gains.find((g) => g.category === "Structure")!;
    // WEIGHTS.structure=15 / 5 checks = 3 per section; summary + skills missing = 2 recoverable
    expect(structure.points).toBe(6);
  });

  it("credits contact gain for invalid contact repair, not for confirmed profile links that already exist", () => {
    const invalidContact = det({ contactValid: false });
    const withExistingLinkedin = resume({ contact: { name: "Jane", email: "a@b.com", phone: "123", linkedin: "linkedin.com/in/jane" } });
    const result = computeCeiling(score(), invalidContact, quality(), withExistingLinkedin, { skills: [], contact: { linkedin: "linkedin.com/in/jane" } });
    const contact = result.gains.find((g) => g.category === "Contact & format")!;
    // WEIGHTS.contact=15 * (0.7-0.2) = 7.5 -> rounds to 8; no bonus since linkedin already present
    expect(contact.points).toBe(8);
  });

  it("credits a confirmed new profile link as additional contact gain", () => {
    const result = computeCeiling(score(), det(), quality(), resume(), { skills: [], contact: { linkedin: "linkedin.com/in/jane" } });
    const contact = result.gains.find((g) => g.category === "Contact & format")!;
    // contactValid true -> 0 base gain; +bonus for one new confirmed field: (1/4)*15*0.3 = 1.125 -> rounds to 1
    expect(contact.points).toBe(1);
  });

  it("never projects experience-fit gain above zero", () => {
    const result = computeCeiling(score(), det(), quality(), resume(), null);
    const experience = result.gains.find((g) => g.category === "Experience fit")!;
    expect(experience.points).toBe(0);
  });

  it("caps bullet-quality gain at the unearned remainder", () => {
    const allWeak = quality({ weakBullets: [{ text: "a", why: "b", fix: "c" }, { text: "d", why: "e", fix: "f" }] });
    const nearMaxScore = score({
      categories: [
        { key: "Keyword coverage", earned: 15, max: 30, reason: "", source: "code" },
        { key: "Experience fit", earned: 12, max: 20, reason: "", source: "llm" },
        { key: "Bullet quality", earned: 19, max: 20, reason: "", source: "llm" }, // only 1 point unearned
        { key: "Structure", earned: 12, max: 15, reason: "", source: "code" },
        { key: "Contact & format", earned: 11, max: 15, reason: "", source: "code" },
      ],
    });
    const result = computeCeiling(nearMaxScore, det(), allWeak, resume(), null);
    const bullets = result.gains.find((g) => g.category === "Bullet quality")!;
    expect(bullets.points).toBeLessThanOrEqual(1);
  });

  it("never projects the score above 100", () => {
    const nearPerfect = score({
      generic: 98,
      categories: [
        { key: "Keyword coverage", earned: 30, max: 30, reason: "", source: "code" },
        { key: "Experience fit", earned: 20, max: 20, reason: "", source: "llm" },
        { key: "Bullet quality", earned: 18, max: 20, reason: "", source: "llm" },
        { key: "Structure", earned: 15, max: 15, reason: "", source: "code" },
        { key: "Contact & format", earned: 15, max: 15, reason: "", source: "code" },
      ],
    });
    const result = computeCeiling(nearPerfect, det({ missingKeywords: [], foundKeywords: [{ term: "node.js", n: 1 }] }), quality(), resume(), { skills: [], contact: {} });
    expect(result.projectedScore).toBeLessThanOrEqual(100);
    expect(result.projectedBand.high).toBeLessThanOrEqual(100);
  });
});
