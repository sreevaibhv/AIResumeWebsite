import { runNaukriOptimizationAgent } from "./naukri-score.agent";
import { ParsedResume, ParsedJD, DeterministicResult } from "./types";

/**
 * NaukriOptimizationAgent (Phase D) has no pre-existing accuracy
 * measurement — this is a real eval against the live model, not a fixture
 * comparison. Each test targets exactly one of the three domain quirks the
 * prompt is built around (headline exact-match, literal-vs-semantic,
 * recency), with the grounding assertion in test 2 being the one
 * automatable slice of the agent's own no-invention instruction: a
 * proposed swap must reference a term that's actually in the JD, never
 * one the model invented.
 *
 * Skips (not fails) without GEMINI_API_KEY, same as the other golden tests.
 */
const HAS_KEY = Boolean(process.env.GEMINI_API_KEY);
const maybeIt = HAS_KEY ? it : it.skip;

const det: DeterministicResult = {
  contactValid: true,
  lengthWords: 200,
  timelineGaps: [],
  actionVerbDensity: 0.6,
  metricBearingBulletRatio: 0.5,
  exactMatchPct: 40,
  foundKeywords: [],
  missingKeywords: [],
  overusedPhrases: [],
};

describe("NaukriOptimizationAgent eval", () => {
  if (!HAS_KEY) {
    it.skip("skipped — GEMINI_API_KEY is not set", () => {});
  }

  maybeIt("headline: proposes the JD's exact title when the resume's headline doesn't match", async () => {
    const resume: ParsedResume = {
      contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
      headline: "Software Engineer",
      summary: "Engineer with 4 years of backend experience.",
      experience: [
        { title: "Software Engineer", company: "Acme Corp", start: "2021-01", end: "Present", bullets: ["Built backend services in Node.js"] },
      ],
      projects: [],
      skills: ["Node.js", "PostgreSQL"],
      education: [{ degree: "B.Tech CSE", institution: "IIT Somewhere", year: "2020" }],
      certifications: [],
    };
    const jd: ParsedJD = {
      title: "Backend Developer",
      company: "Zeta",
      seniority: "Mid",
      minYearsExperience: 3,
      mustHaveSkills: ["Node.js", "PostgreSQL"],
      niceToHaveSkills: [],
      responsibilities: [],
    };

    const result = await runNaukriOptimizationAgent(resume, jd, det);

    expect(result.data.headlineFix.current).toMatch(/software engineer/i);
    expect(result.data.headlineFix.suggested).toMatch(/backend developer/i);
  }, 60000);

  maybeIt("literal swap: proposes 'Kubernetes' verbatim, grounded only in real JD terms", async () => {
    const resume: ParsedResume = {
      contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
      headline: "Backend Developer",
      summary: "Backend engineer focused on distributed systems.",
      experience: [
        {
          title: "Backend Developer",
          company: "Acme Corp",
          start: "2021-01",
          end: "Present",
          bullets: ["Ran container orchestration for a fleet of microservices using industry-standard tooling"],
        },
      ],
      projects: [],
      skills: ["Node.js", "Docker"],
      education: [{ degree: "B.Tech CSE", institution: "IIT Somewhere", year: "2020" }],
      certifications: [],
    };
    const jd: ParsedJD = {
      title: "Backend Developer",
      company: "Zeta",
      seniority: "Mid",
      minYearsExperience: 3,
      mustHaveSkills: ["Node.js", "Kubernetes"],
      niceToHaveSkills: ["gRPC"],
      responsibilities: [],
    };

    const result = await runNaukriOptimizationAgent(resume, jd, det);

    expect(result.data.literalTermSwaps.length).toBeGreaterThan(0);
    const kubernetesSwap = result.data.literalTermSwaps.find((s) => /kubernetes/i.test(s.jdTerm));
    expect(kubernetesSwap).toBeDefined();
    expect(kubernetesSwap?.suggestedPhrase).toMatch(/kubernetes/i);

    // Grounding: every proposed swap's jdTerm must actually be a JD skill —
    // the model must never invent a term to swap toward.
    const jdTerms = new Set([...jd.mustHaveSkills, ...jd.niceToHaveSkills].map((s) => s.toLowerCase()));
    for (const swap of result.data.literalTermSwaps) {
      expect(jdTerms.has(swap.jdTerm.toLowerCase())).toBe(true);
    }
  }, 60000);

  maybeIt("recency: flags a JD-relevant skill evidenced only in an older role, not the current one", async () => {
    const resume: ParsedResume = {
      contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
      headline: "Backend Developer",
      summary: "Backend engineer.",
      experience: [
        {
          title: "Backend Developer",
          company: "Acme Corp",
          start: "2022-01",
          end: "Present",
          bullets: ["Built REST APIs for the checkout flow"],
        },
        {
          title: "Junior Developer",
          company: "OldCo",
          start: "2018-01",
          end: "2019-12",
          bullets: ["Used Kubernetes to deploy internal tooling"],
        },
      ],
      projects: [],
      skills: ["Node.js", "Kubernetes"],
      education: [{ degree: "B.Tech CSE", institution: "IIT Somewhere", year: "2018" }],
      certifications: [],
    };
    const jd: ParsedJD = {
      title: "Backend Developer",
      company: "Zeta",
      seniority: "Mid",
      minYearsExperience: 3,
      mustHaveSkills: ["Node.js", "Kubernetes"],
      niceToHaveSkills: [],
      responsibilities: [],
    };

    const result = await runNaukriOptimizationAgent(resume, jd, det);

    expect(result.data.recencyFixes.length).toBeGreaterThan(0);
    const kubernetesFix = result.data.recencyFixes.find((f) => /kubernetes/i.test(f.skill));
    expect(kubernetesFix).toBeDefined();
    expect(kubernetesFix?.bestEvidenceRole).toMatch(/oldco|2018|2019/i);
  }, 60000);
});
