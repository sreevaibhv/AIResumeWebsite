import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, ParsedJD, ScanOptions } from "./types";
import { CandidatePair } from "../vector/vector-store.interface";

const OutputSchema = z.object({
  semanticMatchPct: z.number().min(0).max(100),
  matches: z.array(z.object({ resume: z.string(), jd: z.string(), conf: z.number() })),
  missingResponsibilities: z.array(z.string()),
  experienceFitScore: z.number().min(0).max(100),
  seniorityFit: z.string(),
  domainFit: z.string(),
});
export type SemanticMatchOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: resume mentions "container orchestration", JD requires "Kubernetes", vector candidate confidence 0.71.
Judgment: credit it as a semantic match at ~0.71, don't require the literal word.

Example: fresherMode=true, resume has 2 strong projects but no formal experience, JD wants "2-4 years".
Judgment: experienceFitScore should weigh project scope/complexity, not penalize for missing years — that's the point of fresher mode.
`.trim();

function buildPrompt(resume: ParsedResume, jd: ParsedJD, candidates: CandidatePair[], options: ScanOptions): string {
  return `
You judge how well a candidate's resume semantically matches a job description. You are given candidate skill/phrase pairs pre-narrowed by vector similarity — adjudicate them, don't just accept the similarity score at face value. Also identify JD responsibilities the resume never addresses, even implicitly.

${options.fresherMode ? "Fresher mode is ON: weigh projects and certifications as primary evidence of ability. Do not penalize for missing years of formal experience." : ""}

Return ONLY JSON matching this shape: {semanticMatchPct, matches:[{resume,jd,conf}], missingResponsibilities[], experienceFitScore, seniorityFit, domainFit}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
JD: ${JSON.stringify(jd)}
Vector candidates (pre-narrowed, not conclusions): ${JSON.stringify(candidates)}
Fresher mode: ${options.fresherMode}
`.trim();
}

export async function runSemanticMatchAgent(
  resume: ParsedResume,
  jd: ParsedJD,
  candidates: CandidatePair[],
  options: ScanOptions,
  scanId?: string,
) {
  const prompt = buildPrompt(resume, jd, candidates, options);
  return completeStructured(prompt, OutputSchema, "SemanticMatchAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated from real scans during Phase 1 user testing — needs live examples, not synthetic ones, since this agent's whole job is judgment calls on ambiguous matches." },
];
