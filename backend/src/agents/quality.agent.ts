import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume } from "./types";

const OutputSchema = z.object({
  // .int() on every 0-100 score — P0 fix. See semantic-match.agent.ts's
  // OutputSchema comment for the mechanism: an un-constrained 0.95 silently
  // passes .min(0).max(100), then score-aggregator's (score/100)*weight
  // arithmetic collapses a 95% judgment to ~0 earned points. .int() turns
  // that into a validation failure, which triggers completeStructured's
  // existing correction retry instead of shipping a bogus score.
  sections: z.array(z.object({ name: z.string(), score: z.number().int().min(0).max(100), note: z.string() })),
  weakBullets: z.array(z.object({ text: z.string(), why: z.string(), fix: z.string() })),
  bulletQualityScore: z.number().int().min(0).max(100),
  summaryScore: z.number().int().min(0).max(100),
  summaryNote: z.string(),
});
export type QualityOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example weak bullet: "Responsible for maintaining backend services and fixing bugs."
why: "Passive opener, no scope, no outcome."
fix: "Name the service, its scale, and what changed."

Example strong bullet (not flagged): "Cut p95 checkout latency from 800ms to 210ms by moving session lookups to Redis."
`.trim();

function buildPrompt(resume: ParsedResume): string {
  return `
You review resume writing quality independent of any JD — weak bullets, thin summaries, section-by-section clarity. Flag bullets that hide the candidate's actual contribution (passive voice, no scope, no measurable outcome). Score each present section 0-100 on specificity and clarity, and give one candid, actionable fix per weak bullet.

Every score (sections[].score, bulletQualityScore, summaryScore) is a whole integer from 0 to 100 (e.g. 95, not 0.95) — a percentage, not a 0-1 fraction.

Return ONLY JSON matching this shape: {sections:[{name,score,note}], weakBullets:[{text,why,fix}], bulletQualityScore, summaryScore, summaryNote}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
`.trim();
}

export async function runQualityAgent(resume: ParsedResume, scanId?: string) {
  const prompt = buildPrompt(resume);
  // temperature: 0 — see semantic-match.agent.ts's call site for why.
  return completeStructured(prompt, OutputSchema, "QualityAgent", { scanId, temperature: 0 });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated from real scans during Phase 1 — bullet-quality judgment needs real resume text, not synthetic examples." },
];
