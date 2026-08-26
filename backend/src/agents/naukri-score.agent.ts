import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, ParsedJD, DeterministicResult } from "./types";

/**
 * Shared between the score (below) and the optimisation agent (Phase D) so
 * the two prompts describe Naukri's known quirks identically instead of
 * drifting apart the next time either is edited.
 */
const NAUKRI_QUIRKS = "Naukri weights: exact keyword-in-headline/title match far more than a generic ATS, recency (skills used in the most recent role count more than older ones), and literal keyword presence over semantic synonyms — the opposite of most company ATS, which credit semantic matches.";

const OutputSchema = z.object({
  naukriScore: z.number().min(0).max(100),
  gapReason: z.string(),
});
export type NaukriOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
${NAUKRI_QUIRKS}

Example: resume headline "Software Engineer", JD title "Backend Developer", 9 of 21 JD keywords absent from body.
-> {"naukriScore":61,"gapReason":"Naukri weights keywords in your headline and title. Yours reads \\"Software Engineer\\", not \\"Backend Developer\\"."}
`.trim();

// Note: this agent runs in the same parallel wave as SemanticMatchAgent and
// QualityAgent (§8.3), before ScoreAggregator computes the generic score —
// so it cannot take the generic score as input. The gap between naukriScore
// and the generic score is computed downstream (frontend, ScorePanel) as
// plain arithmetic, not asked of the model.
function buildPrompt(resume: ParsedResume, jd: ParsedJD, det: DeterministicResult): string {
  return `
You compute a Naukri-specific ATS score, which differs from how a generic company ATS scores the same resume. Naukri weights: (1) exact keyword match in headline/title far more than a generic ATS, (2) recency — skills used in the most recent role count more than older ones, (3) literal keyword presence over semantic synonyms. Score 0-100 and explain the single biggest reason a generic-ATS-friendly resume would score lower here, in one sentence a non-technical user understands.

Return ONLY JSON matching this shape: {naukriScore, gapReason}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
JD: ${JSON.stringify(jd)}
Deterministic findings: ${JSON.stringify(det)}
`.trim();
}

export async function runNaukriScoreAgent(
  resume: ParsedResume,
  jd: ParsedJD,
  det: DeterministicResult,
  scanId?: string,
) {
  const prompt = buildPrompt(resume, jd, det);
  return completeStructured(prompt, OutputSchema, "NaukriScoreAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated once Phase 1's exit-criteria testing confirms real Naukri scoring behavior — this agent's entire value is matching a live external system's quirks." },
];

/**
 * Phase D — portal optimisation. A sibling to runNaukriScoreAgent, not a
 * schema-switching "mode": this codebase has no precedent for a parameter
 * that swaps an agent's Zod output shape (the only two "varies behavior"
 * precedents — ScanOptions.fresherMode, TierCalibrationAgent's tier param —
 * both keep the schema fixed and only vary prompt content). This is "a
 * mode of NaukriScoreAgent" in the sense the brief meant: same file, same
 * domain knowledge (NAUKRI_QUIRKS), reusing the same resume/jd/det inputs —
 * with its own schema because its output is materially richer (prescriptive
 * fixes, not a bounded score+sentence).
 *
 * Every field maps to one of the three quirks above — no generic resume
 * advice, which is QualityAgent/RoadmapAgent's job already.
 */
const OptimizationOutputSchema = z.object({
  headlineFix: z.object({
    current: z.string(),
    suggested: z.string(),
    why: z.string(),
  }),
  literalTermSwaps: z.array(
    z.object({
      jdTerm: z.string(),
      currentPhrase: z.string(),
      suggestedPhrase: z.string(),
      insertLocation: z.string(),
    }),
  ),
  recencyFixes: z.array(
    z.object({
      skill: z.string(),
      bestEvidenceRole: z.string(),
      recommendation: z.string(),
    }),
  ),
  summary: z.string(),
});
export type NaukriOptimizationOutput = z.infer<typeof OptimizationOutputSchema>;

const OPTIMIZATION_FEW_SHOT = `
${NAUKRI_QUIRKS}

Example: resume headline "Software Engineer", JD title "Backend Developer". Resume bullet says "container orchestration" but never "Kubernetes", which the JD lists as a must-have. Resume mentions "Redis" only under a 2019 role, not the current one.
-> {
  "headlineFix": {"current":"Software Engineer","suggested":"Backend Developer","why":"Naukri weights an exact headline/title match heavily; \\"Software Engineer\\" does not match the JD's \\"Backend Developer\\"."},
  "literalTermSwaps": [{"jdTerm":"Kubernetes","currentPhrase":"container orchestration","suggestedPhrase":"Kubernetes","insertLocation":"Skills section"}],
  "recencyFixes": [{"skill":"Redis","bestEvidenceRole":"Acme Corp, 2018-2019","recommendation":"Restate Redis usage under your current role if you still use it there — Naukri weights recent-role evidence more than older roles."}],
  "summary": "Your headline doesn't match the JD's exact title, which is the single biggest Naukri-specific gap here."
}
`.trim();

function buildOptimizationPrompt(resume: ParsedResume, jd: ParsedJD, det: DeterministicResult): string {
  return `
${NAUKRI_QUIRKS}

Produce concrete, literal, copy-pasteable fixes specifically for beating Naukri's parser — not generic resume advice, which is covered elsewhere. Rules:

1. Headline: compare the resume's headline against the JD's title. If not an exact or near-exact match, propose a replacement containing the JD's exact title while staying truthful to the candidate's real role/seniority — never invent a title the resume doesn't support. If the headline already matches, suggested must equal current.
2. Literal term swaps: for each JD must-have/nice-to-have term that is either missing from the resume or present only as a semantic synonym (not the literal string anywhere in the resume), propose the literal phrase and where to insert it — but ONLY if the underlying skill or experience is already truthfully evidenced somewhere in the resume. Never propose adding a skill or claim with zero basis in the resume — that is the candidate lying to the portal, not passing its parser. If no such term exists, return an empty array.
3. Recency: cross-reference resume skills against experience entries by date. For any JD-relevant skill whose only evidence sits in an older role and not the most recent one, recommend restating it under the most recent role's bullets — grounded only in something already claimed, never fabricated. If nothing qualifies, return an empty array.
4. Summary: one sentence naming the single highest-leverage fix of the three, for a non-technical reader.

Return ONLY JSON matching this shape: {headlineFix:{current,suggested,why}, literalTermSwaps:[{jdTerm,currentPhrase,suggestedPhrase,insertLocation}], recencyFixes:[{skill,bestEvidenceRole,recommendation}], summary}

${OPTIMIZATION_FEW_SHOT}

Resume: ${JSON.stringify(resume)}
JD: ${JSON.stringify(jd)}
Deterministic findings: ${JSON.stringify(det)}
`.trim();
}

export async function runNaukriOptimizationAgent(
  resume: ParsedResume,
  jd: ParsedJD,
  det: DeterministicResult,
  scanId?: string,
) {
  const prompt = buildOptimizationPrompt(resume, jd, det);
  return completeStructured(prompt, OptimizationOutputSchema, "NaukriOptimizationAgent", { scanId });
}
