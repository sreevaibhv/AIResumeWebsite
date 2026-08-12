import { ParsedResume, ParsedJD, DeterministicResult } from "./types";

/**
 * DeterministicCheckAgent — Master Plan §8.2. No LLM call. Pure TypeScript.
 * FR-1: keyword density, contact validity, length, timeline gaps, action
 * verbs, metric-bearing bullets, exact-match % — all computed locally.
 * Returns in milliseconds, which is why E8's streaming loading state can
 * show this row filled in before any model call resolves.
 */

const ACTION_VERBS = [
  "built", "led", "designed", "implemented", "shipped", "reduced", "increased",
  "optimized", "architected", "launched", "automated", "migrated", "scaled",
  "improved", "created", "developed", "delivered", "owned", "drove", "wrote",
];

const WEAK_OPENERS = ["responsible for", "worked on", "helped", "involved in", "assisted with"];

const METRIC_PATTERN = /\d+(\.\d+)?\s*(%|percent|x|ms|s|seconds|hrs|hours|users|requests|rps|qps|k\b|m\b|million|thousand|\$|₹)/i;

function allBullets(resume: ParsedResume): string[] {
  return [
    ...resume.experience.flatMap((e) => e.bullets),
    ...resume.projects.flatMap((p) => p.bullets),
  ];
}

function normalize(term: string): string {
  return term.toLowerCase().trim();
}

export function runDeterministicCheck(resume: ParsedResume, jd: ParsedJD): DeterministicResult {
  const bullets = allBullets(resume);
  const resumeText = [
    resume.headline,
    resume.summary,
    ...resume.skills,
    ...bullets,
  ].join(" ").toLowerCase();

  const contactValid = Boolean(
    resume.contact.email?.includes("@") &&
    resume.contact.phone?.replace(/\D/g, "").length >= 10,
  );

  const lengthWords = resumeText.split(/\s+/).filter(Boolean).length;

  // Timeline gaps: flag any >6 month gap between consecutive experience entries.
  const timelineGaps: string[] = [];
  const sorted = [...resume.experience].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = Date.parse(sorted[i - 1].end || Date.now().toString());
    const curStart = Date.parse(sorted[i].start);
    if (!Number.isNaN(prevEnd) && !Number.isNaN(curStart)) {
      const gapMonths = (curStart - prevEnd) / (1000 * 60 * 60 * 24 * 30);
      if (gapMonths > 6) {
        timelineGaps.push(`${sorted[i - 1].end} → ${sorted[i].start} (${Math.round(gapMonths)} months)`);
      }
    }
  }

  const actionVerbDensity = bullets.length
    ? bullets.filter((b) => ACTION_VERBS.some((v) => normalize(b).startsWith(v))).length / bullets.length
    : 0;

  const metricBearingBulletRatio = bullets.length
    ? bullets.filter((b) => METRIC_PATTERN.test(b)).length / bullets.length
    : 0;

  const jdSkills = [...jd.mustHaveSkills, ...jd.niceToHaveSkills].map(normalize);
  const uniqueJdSkills = Array.from(new Set(jdSkills));

  const foundKeywords: Array<{ term: string; n: number }> = [];
  const missingKeywords: Array<{ term: string; priority: "critical" | "important" | "nice"; where: string }> = [];

  for (const skill of uniqueJdSkills) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = resumeText.match(re);
    if (matches && matches.length > 0) {
      foundKeywords.push({ term: skill, n: matches.length });
    } else {
      const isMustHave = jd.mustHaveSkills.map(normalize).includes(skill);
      missingKeywords.push({
        term: skill,
        priority: isMustHave ? "critical" : "important",
        where: isMustHave ? "Skills + one relevant bullet" : "Skills",
      });
    }
  }

  const exactMatchPct = uniqueJdSkills.length
    ? Math.round((foundKeywords.length / uniqueJdSkills.length) * 100)
    : 0;

  const overusedPhrases = WEAK_OPENERS
    .map((phrase) => ({
      term: phrase,
      n: bullets.filter((b) => normalize(b).startsWith(phrase)).length,
    }))
    .filter((p) => p.n > 0);

  return {
    contactValid,
    lengthWords,
    timelineGaps,
    actionVerbDensity,
    metricBearingBulletRatio,
    exactMatchPct,
    foundKeywords,
    missingKeywords,
    overusedPhrases,
  };
}

// Golden tests — Master Plan §8.1, step 4. No LLM involved, so these are
// exact-value assertions, not fuzzy golden-set comparisons.
export const goldenTests: Array<{
  resume: ParsedResume;
  jd: ParsedJD;
  expect: Partial<DeterministicResult>;
}> = [
  {
    resume: {
      contact: { name: "A", email: "a@b.com", phone: "9876543210" },
      headline: "Software Engineer",
      summary: "",
      experience: [{ title: "SWE", company: "X", start: "2023-01", end: "2024-06", bullets: ["Built a service handling 10k rps"] }],
      projects: [],
      skills: ["Node.js", "PostgreSQL"],
      education: [],
      certifications: [],
    },
    jd: {
      title: "Backend Developer",
      company: "Zeta",
      seniority: "Junior",
      minYearsExperience: 2,
      mustHaveSkills: ["Kubernetes", "Node.js"],
      niceToHaveSkills: ["gRPC"],
      responsibilities: [],
    },
    expect: { contactValid: true, exactMatchPct: 33 }, // 1 of 3 unique skills found
  },
  {
    resume: {
      contact: { name: "B", email: "not-an-email", phone: "123" },
      headline: "Dev",
      summary: "",
      experience: [],
      projects: [],
      skills: [],
      education: [],
      certifications: [],
    },
    jd: {
      title: "X",
      company: "Y",
      seniority: "Junior",
      minYearsExperience: 0,
      mustHaveSkills: [],
      niceToHaveSkills: [],
      responsibilities: [],
    },
    expect: { contactValid: false, exactMatchPct: 0 },
  },
];
