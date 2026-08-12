/**
 * Shared domain types passed between agents and the orchestrator.
 * Deliberately mirrors the shape the frontend already expects
 * (frontend/src/screens/ATSScanReport.jsx's mock DATA object) so wiring E4
 * to the live API is a field mapping, not a rebuild.
 */

export type Tier = "Startup" | "MNC" | "PSU" | "Government";

export interface ScanOptions {
  tier: Tier;
  fresherMode: boolean;
}

export interface ParsedResume {
  contact: { name: string; email: string; phone: string; linkedin?: string; github?: string };
  headline: string;
  summary: string;
  experience: Array<{ title: string; company: string; start: string; end: string; bullets: string[] }>;
  projects: Array<{ name: string; bullets: string[] }>;
  skills: string[];
  education: Array<{ degree: string; institution: string; year: string }>;
  certifications: string[];
}

export interface ParsedJD {
  title: string;
  company: string;
  seniority: string;
  minYearsExperience: number;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilities: string[];
}

export interface DeterministicResult {
  contactValid: boolean;
  lengthWords: number;
  timelineGaps: string[];
  actionVerbDensity: number; // 0-1
  metricBearingBulletRatio: number; // 0-1
  exactMatchPct: number; // 0-100, exact keyword overlap vs JD
  foundKeywords: Array<{ term: string; n: number }>;
  missingKeywords: Array<{ term: string; priority: "critical" | "important" | "nice"; where: string }>;
  overusedPhrases: Array<{ term: string; n: number }>;
}

export interface SemanticMatchResult {
  semanticMatchPct: number; // 0-100
  matches: Array<{ resume: string; jd: string; conf: number }>;
  missingResponsibilities: string[];
  experienceFitScore: number; // 0-100, feeds ScoreAggregator's "Experience fit" category
  seniorityFit: string; // short note, e.g. "1.5 yrs against a 2-4 yr band; seniority reads Junior"
  domainFit: string;
}

export interface QualityResult {
  sections: Array<{ name: string; score: number; note: string }>;
  weakBullets: Array<{ text: string; why: string; fix: string }>;
  bulletQualityScore: number; // 0-100, feeds ScoreAggregator's "Bullet quality" category
  summaryScore: number;
  summaryNote: string;
}

export interface NaukriResult {
  naukriScore: number; // 0-100
  // gap vs. the generic score is computed downstream as plain arithmetic
  // (generic - naukri), not asked of the model — see naukri-score.agent.ts.
  gapReason: string;
}

export interface ScoreCategory {
  key: string;
  earned: number;
  max: number;
  reason: string;
  source: "code" | "llm";
}

export interface ScoreResult {
  generic: number; // 0-100
  naukri: number; // 0-100
  exactMatch: number;
  semanticMatch: number;
  categories: ScoreCategory[];
  gapReason: string;
}

export interface RoadmapItem {
  rank: number;
  fix: string;
  gain: number;
  conf: "high" | "medium" | "low";
  evidence: string;
}

export interface VerifyResult {
  passed: boolean;
  flaggedClaims: Array<{ claim: string; reason: string }>;
}

export interface InterviewPrepResult {
  technical: Array<{ question: string; why: string }>;
  hr: Array<{ question: string; why: string }>;
}
