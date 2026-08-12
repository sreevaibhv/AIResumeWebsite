import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, ParsedJD, DeterministicResult } from "./types";

const OutputSchema = z.object({
  naukriScore: z.number().min(0).max(100),
  gapReason: z.string(),
});
export type NaukriOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Naukri weights: exact keyword-in-headline match heavily, recency of skills (recent roles > old ones), and rewards literal terms over synonyms — the opposite of most company ATS, which credit semantic matches.

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
